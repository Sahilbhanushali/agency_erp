import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAuditAction } from "@/lib/audit";
import { can, hasPermission } from "@/lib/api-auth";
import { PayrollService } from "@/lib/payroll/payroll-service";
import { deleteLocalFile } from "@/lib/storage";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = parseInt(params.id, 10);
    if (isNaN(userId)) {
      return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });
    }

    const currentUserId = parseInt(session.user.id, 10);
    const isSelf = currentUserId === userId;
    const isHrOrAdmin = await can(session, "users", "read");

    // If requester is not self and not HR/Admin: return only non-confidential public directory fields
    if (!isSelf && !isHrOrAdmin) {
      const publicUser = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          email: true,
          avatar: true,
          createdAt: true,
          designation: true,
          department: true,
          role: { select: { id: true, name: true } },
          assignedProjects: { select: { id: true, name: true } },
        },
      });

      if (!publicUser) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }
      return NextResponse.json(publicUser);
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true,
        createdAt: true,
        roleId: true,
        role: { select: { id: true, name: true } },
        joiningDate: true,
        designation: true,
        department: true,
        currentSalary: true,
        salaryFrequency: true,
        employmentType: true,
        phone: true,
        personalEmail: true,
        address: true,
        panNumber: true,
        aadhaarNumber: true,
        bankName: true,
        bankAccountNumber: true,
        bankIfsc: true,
        emergencyContactName: true,
        emergencyContactPhone: true,
        emergencyContactRelation: true,
        offerLetterUrl: true,
        exitStatus: true,
        exitDate: true,
        documents: {
          orderBy: { uploadedAt: "desc" },
        },
        assignedProjects: {
          select: { id: true, name: true },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json(user);
  } catch (error: any) {
    console.error("Error fetching user details:", error);
    return NextResponse.json({ error: "Internal server error", details: error.message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  try {
    const session = await getServerSession(authOptions);
    const userRole = (session?.user as any)?.role || "";
    const canManage = session?.user?.id && (
      (await can(session, "users", "update")) ||
      (await can(session, "salary", "update"))
    );

    if (!canManage) {
      return NextResponse.json({ error: "Forbidden: HR or Admin access required" }, { status: 403 });
    }

    const body = await request.json();
    const {
      name,
      email,
      role,
      joiningDate,
      designation,
      department,
      currentSalary,
      salaryFrequency,
      employmentType,
      phone,
      personalEmail,
      address,
      panNumber,
      aadhaarNumber,
      bankName,
      bankAccountNumber,
      bankIfsc,
      emergencyContactName,
      emergencyContactPhone,
      emergencyContactRelation,
      offerLetterUrl,
      exitStatus,
      exitDate,
    } = body;

    if (!name || !email) {
      return NextResponse.json({ error: "Name and email are required" }, { status: 400 });
    }

    const targetUserId = parseInt(params.id, 10);
    if (isNaN(targetUserId)) {
      return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });
    }

    /**
     * Only fields the request actually sent are written.
     *
     * This used to build the full record unconditionally, defaulting every absent key
     * to null. Two different forms post here: the HR profile, which sends everything,
     * and the Users page edit dialog, which sends only name, email and role. Saving
     * from the Users page therefore wiped the person's joining date, designation,
     * department, salary, phone, address, PAN, Aadhaar, bank details and emergency
     * contact — silently, with a "User updated successfully" toast.
     */
    const data: any = { name, email };
    const present = (key: string) => Object.prototype.hasOwnProperty.call(body, key);
    const setIfSent = (key: string, value: unknown) => {
      if (present(key)) data[key] = value;
    };

    setIfSent("joiningDate", joiningDate ? new Date(joiningDate) : null);
    setIfSent("designation", designation || null);
    setIfSent("department", department || null);
    setIfSent(
      "currentSalary",
      currentSalary !== undefined && currentSalary !== null && currentSalary !== ""
        ? Number(currentSalary)
        : null,
    );
    setIfSent("salaryFrequency", salaryFrequency || "MONTHLY");
    setIfSent("employmentType", employmentType || "FULL_TIME");
    setIfSent("phone", phone || null);
    setIfSent("personalEmail", personalEmail || null);
    setIfSent("address", address || null);
    setIfSent("panNumber", panNumber || null);
    setIfSent("aadhaarNumber", aadhaarNumber || null);
    setIfSent("bankName", bankName || null);
    setIfSent("bankAccountNumber", bankAccountNumber || null);
    setIfSent("bankIfsc", bankIfsc || null);
    setIfSent("emergencyContactName", emergencyContactName || null);
    setIfSent("emergencyContactPhone", emergencyContactPhone || null);
    setIfSent("emergencyContactRelation", emergencyContactRelation || null);
    setIfSent("offerLetterUrl", offerLetterUrl || null);
    if (exitStatus) data.exitStatus = exitStatus;
    if (exitDate) data.exitDate = new Date(exitDate);

    if (role) {
      const roleObj = await prisma.role.findUnique({ where: { name: role } });
      if (!roleObj) return NextResponse.json({ error: "Invalid role" }, { status: 400 });
      data.roleId = roleObj.id;
    }

    // Check existing files to clean up if replaced
    const existingUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { avatar: true, offerLetterUrl: true, currentSalary: true, salaryFrequency: true },
    });

    if (present("avatar") && existingUser?.avatar && existingUser.avatar !== body.avatar) {
      await deleteLocalFile(existingUser.avatar);
    }
    if (present("offerLetterUrl") && existingUser?.offerLetterUrl && existingUser.offerLetterUrl !== offerLetterUrl) {
      await deleteLocalFile(existingUser.offerLetterUrl);
    }

    const user = await prisma.user.update({
      where: { id: targetUserId },
      data,
      include: { role: true, documents: true },
    });

    /**
     * The profile is where salary is set; the structure follows it. Re-split with the
     * template the employee is on (or the default) — this used to write a fixed 50/25/25
     * split on every save, throwing away their template, and read a yearly salary as
     * monthly. Only when the salary or its frequency actually changed.
     */
    let salaryNotice: string | null = null;
    const salaryChanged =
      (present("currentSalary") && String(data.currentSalary ?? "") !== String(existingUser?.currentSalary ?? "")) ||
      (present("salaryFrequency") && data.salaryFrequency !== (existingUser?.salaryFrequency ?? "MONTHLY"));
    if (salaryChanged && user.currentSalary != null) {
      try {
        await PayrollService.assignStructureFromProfile({
          userId: targetUserId,
          actorUserId: parseInt(session.user.id, 10),
          revisionReason: "Salary changed on HR profile",
          onlyIfChanged: true,
        });
      } catch (err: any) {
        salaryNotice = `Profile saved, but the salary structure was not updated: ${err.message}`;
      }
    }

    await logAuditAction({
      userId: session.user.id,
      action: "UPDATE",
      entityType: "User",
      entityId: params.id,
      newValues: JSON.stringify({ name, email, role: role || user.role?.name, designation, currentSalary }),
      ipAddress: request.headers.get("x-forwarded-for") || "unknown",
      userAgent: request.headers.get("user-agent") || "unknown",
    });

    return NextResponse.json({
      message: "User updated successfully",
      user,
      salaryNotice,
    });
  } catch (error: any) {
    console.error("Error updating user:", error);
    return NextResponse.json({ error: "Internal server error", details: error.message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  try {
    const session = await getServerSession(authOptions);
    // Changing someone's role is a permission change, so it needs roles:update.
    // This used to require a role literally named ADMIN, which meant a role granted
    // every permission in the matrix still could not do it.
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!(await can(session, "roles", "update"))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { role } = await request.json();
    if (!role) {
      return NextResponse.json({ error: "Role is required" }, { status: 400 });
    }

    const roleObj = await prisma.role.findUnique({ where: { name: role } });
    if (!roleObj) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }

    const user = await prisma.user.update({
      where: { id: parseInt(params.id) },
      data: { roleId: roleObj.id },
      include: { role: true },
    });

    await logAuditAction({
      userId: session.user.id,
      action: "UPDATE",
      entityType: "User",
      entityId: params.id,
      newValues: JSON.stringify({ role: roleObj.name }),
      ipAddress: request.headers.get("x-forwarded-for") || "unknown",
      userAgent: request.headers.get("user-agent") || "unknown",
    });

    return NextResponse.json({
      message: "User role updated successfully",
      user: {
        id: user.id.toString(),
        name: user.name,
        email: user.email,
        role: user.role?.name || null,
      },
    });
  } catch (error) {
    console.error("Error updating user role:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * Deactivates a user. Nothing is deleted.
 *
 * A real delete cascaded away payroll, payslips, salary history, attendance and leave
 * records, and blanked the author on everything else the person had touched — posts,
 * approvals, invoices, audit logs. Those are records an agency has to keep, so the
 * destructive version is gone: this removes access and leaves every row and every
 * attribution intact.
 *
 * Access ends immediately, not at the next sign-in. `lib/auth.ts` refuses the login and
 * `requireSession()` in lib/api-auth.ts rejects the existing JWT on the next request,
 * because a session token outlives a deactivation otherwise.
 */
export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!(await can(session, "users", "delete"))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const id = parseInt(params.id, 10);
    if (isNaN(id)) {
      return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, name: true, email: true, isActive: true, role: { select: { name: true } } },
    });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Locking yourself out would need another administrator to undo.
    if (user.id.toString() === session.user.id) {
      return NextResponse.json({ error: "You cannot deactivate your own account" }, { status: 400 });
    }
    if (!user.isActive) {
      return NextResponse.json({ error: "This account is already deactivated" }, { status: 409 });
    }

    await prisma.user.update({
      where: { id },
      data: {
        isActive: false,
        deactivatedAt: new Date(),
        deactivatedById: parseInt(session.user.id, 10) || null,
      },
    });

    await logAuditAction({
      userId: session.user.id,
      action: "USER_DEACTIVATED",
      entityType: "User",
      entityId: params.id,
      oldValues: JSON.stringify({ isActive: true }),
      newValues: JSON.stringify({
        isActive: false,
        name: user.name,
        email: user.email,
        role: user.role?.name,
      }),
      ipAddress: request.headers.get("x-forwarded-for") || "unknown",
      userAgent: request.headers.get("user-agent") || "unknown",
    });

    return NextResponse.json({
      message: `${user.name} can no longer sign in. Their work and records are unchanged.`,
      isActive: false,
    });
  } catch (error) {
    console.error("Error deactivating user:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/** Restores a deactivated user. Same permission — whoever can remove access can return it. */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!(await can(session, "users", "delete"))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const id = parseInt(params.id, 10);
    if (isNaN(id)) {
      return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, name: true, isActive: true },
    });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    if (user.isActive) {
      return NextResponse.json({ error: "This account is already active" }, { status: 409 });
    }

    await prisma.user.update({
      where: { id },
      data: { isActive: true, deactivatedAt: null, deactivatedById: null },
    });

    await logAuditAction({
      userId: session.user.id,
      action: "USER_REACTIVATED",
      entityType: "User",
      entityId: params.id,
      oldValues: JSON.stringify({ isActive: false }),
      newValues: JSON.stringify({ isActive: true, name: user.name }),
      ipAddress: request.headers.get("x-forwarded-for") || "unknown",
      userAgent: request.headers.get("user-agent") || "unknown",
    });

    return NextResponse.json({ message: `${user.name} can sign in again.`, isActive: true });
  } catch (error) {
    console.error("Error reactivating user:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
