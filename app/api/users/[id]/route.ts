import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAuditAction } from "@/lib/audit";
import { can, hasPermission } from "@/lib/api-auth";
import { PayrollService } from "@/lib/payroll/payroll-service";

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
    const userRole = (session.user as any).role || "";
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

    let data: any = {
      name,
      email,
      joiningDate: joiningDate ? new Date(joiningDate) : null,
      designation: designation || null,
      department: department || null,
      currentSalary: currentSalary !== undefined && currentSalary !== null && currentSalary !== "" ? Number(currentSalary) : null,
      salaryFrequency: salaryFrequency || "MONTHLY",
      employmentType: employmentType || "FULL_TIME",
      phone: phone || null,
      personalEmail: personalEmail || null,
      address: address || null,
      panNumber: panNumber || null,
      aadhaarNumber: aadhaarNumber || null,
      bankName: bankName || null,
      bankAccountNumber: bankAccountNumber || null,
      bankIfsc: bankIfsc || null,
      emergencyContactName: emergencyContactName || null,
      emergencyContactPhone: emergencyContactPhone || null,
      emergencyContactRelation: emergencyContactRelation || null,
      offerLetterUrl: offerLetterUrl || null,
      exitStatus: exitStatus || undefined,
      exitDate: exitDate ? new Date(exitDate) : undefined,
    };

    if (role) {
      const roleObj = await prisma.role.findUnique({ where: { name: role } });
      if (!roleObj) return NextResponse.json({ error: "Invalid role" }, { status: 400 });
      data.roleId = roleObj.id;
    }

    const user = await prisma.user.update({
      where: { id: targetUserId },
      data,
      include: { role: true, documents: true },
    });

    // Synchronize with SalaryStructure so compensation is never desynchronized
    if (currentSalary !== undefined && currentSalary !== null && currentSalary !== "") {
      try {
        const monthlyGrossPaise = Math.round(Number(currentSalary) * 100);
        const basicPaise = Math.round(monthlyGrossPaise * 0.50);
        const hraPaise = Math.round(monthlyGrossPaise * 0.25);
        const specialPaise = Math.round(monthlyGrossPaise * 0.25);

        await PayrollService.upsertSalaryStructure({
          userId: targetUserId,
          basicSalary: basicPaise,
          hra: hraPaise,
          specialAllowance: specialPaise,
          actorUserId: parseInt(session.user.id, 10),
          revisionReason: "User profile compensation update",
        });
      } catch (err: any) {
        console.warn("SalaryStructure sync notice:", err.message);
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
    if (!session?.user?.id || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !["ADMIN", "MANAGER", "Manager"].includes(session.user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: parseInt(params.id) },
      include: { role: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (user.id.toString() === session.user.id) {
      return NextResponse.json({ error: "Cannot delete yourself" }, { status: 400 });
    }

    await prisma.user.delete({
      where: { id: parseInt(params.id) },
    });

    await logAuditAction({
      userId: session.user.id,
      action: "DELETE",
      entityType: "User",
      entityId: params.id,
      oldValues: JSON.stringify({ name: user.name, email: user.email, role: user.role?.name }),
      ipAddress: request.headers.get("x-forwarded-for") || "unknown",
      userAgent: request.headers.get("user-agent") || "unknown",
    });

    return NextResponse.json({ message: "User deleted successfully" });
  } catch (error) {
    console.error("Error deleting user:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}