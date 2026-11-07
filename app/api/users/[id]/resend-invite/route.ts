import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAuditAction } from "@/lib/audit";
import { can, hasPermission } from "@/lib/api-auth";
import { sendOnboardingInviteEmail } from "@/lib/email";
import { issuePasswordToken } from "@/lib/password-token";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const canManageUsers = session?.user && (
      await can(session, "users", "update")
    );

    if (!canManageUsers) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const userId = Number(id);

    if (!Number.isFinite(userId)) {
      return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        role: { select: { name: true } },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Revokes prior pending tokens; only the hash is stored.
    const setupToken = await issuePasswordToken(user.email, 48 * 3600 * 1000); // 48 hours validity

    // Send onboarding invite email
    await sendOnboardingInviteEmail({
      email: user.email,
      name: user.name,
      role: user.role?.name || "Team Member",
      token: setupToken,
    });

    // Audit log
    await logAuditAction({
      userId: String(session.user.id),
      action: "UPDATE",
      entityType: "User",
      entityId: String(user.id),
      oldValues: JSON.stringify({ action: "prior_invite_invalidated" }),
      newValues: JSON.stringify({ action: "onboarding_invite_resent", recipient: user.email }),
      ipAddress: request.headers.get("x-forwarded-for") || "unknown",
      userAgent: request.headers.get("user-agent") || "unknown",
    });

    return NextResponse.json({
      success: true,
      message: `Onboarding invitation email sent to ${user.email}`,
    });
  } catch (error: any) {
    console.error("Resend invite error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to resend invitation email" },
      { status: 500 }
    );
  }
}
