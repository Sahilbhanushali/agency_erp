import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { LeaveService } from "@/lib/payroll/leave-service";
import { can, requireCan } from "@/lib/api-auth";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireCan("leaves", "approve");
    if (!auth.ok) return auth.response;
    const session = auth.session;
    const { id } = await params;
    const body = await request.json();
    const currentUserId = Number(session.user.id);
    const userRole = (session.user as any).role || "";
    // Employees may still act on their own leave; this only decides whether they
    // may act on anyone else’s.
    const isStaffOrAdmin = await can(session, "leaves", "approve");

    const leave = await prisma.leaveRequest.findUnique({
      where: { id },
    });
    if (!leave) {
      return NextResponse.json({ error: "Leave request not found" }, { status: 404 });
    }

    if (body.status === "CANCELLED") {
      // Applicant can cancel their own leave, or HR/Admin can cancel
      if (leave.userId !== currentUserId && !(await can(session, "leaves", "approve"))) {
        return NextResponse.json(
          { error: "Forbidden: You can only cancel your own leave request" },
          { status: 403 }
        );
      }

      const updated = await LeaveService.cancelLeave({
        leaveRequestId: id,
        actorUserId: currentUserId,
        reason: body.remarks || body.reason || "Cancelled",
      });

      return NextResponse.json(updated);
    }

    if (!["APPROVED", "REJECTED"].includes(body.status)) {
      return NextResponse.json(
        { error: "Status must be APPROVED, REJECTED, or CANCELLED" },
        { status: 400 }
      );
    }

    if (!isStaffOrAdmin) {
      return NextResponse.json({ error: "Forbidden: HR or Manager access required" }, { status: 403 });
    }

    if (leave.userId === currentUserId) {
      return NextResponse.json(
        { error: "Forbidden: Self-approval is not permitted. Leave requests must be reviewed by another manager or HR" },
        { status: 403 }
      );
    }

    const updated = await LeaveService.reviewLeave({
      leaveRequestId: id,
      status: body.status,
      approverId: currentUserId,
      remarks: body.remarks,
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error("PATCH /api/leaves/[id] error:", error);
    return NextResponse.json({ error: error.message || "Failed to update leave request" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireCan("leaves", "delete");
    if (!auth.ok) return auth.response;
    const session = auth.session;
    const { id } = await params;
    const currentUserId = Number(session.user.id);
    const userRole = (session.user as any).role || "";

    const leave = await prisma.leaveRequest.findUnique({ where: { id } });
    if (!leave) {
      return NextResponse.json({ error: "Leave request not found" }, { status: 404 });
    }

    if (leave.userId !== currentUserId && !(await can(session, "leaves", "approve"))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const updated = await LeaveService.cancelLeave({
      leaveRequestId: id,
      actorUserId: currentUserId,
      reason: "Deleted by requester",
    });

    return NextResponse.json({ success: true, leave: updated });
  } catch (error: any) {
    console.error("DELETE /api/leaves/[id] error:", error);
    return NextResponse.json({ error: error.message || "Failed to cancel leave" }, { status: 500 });
  }
}
