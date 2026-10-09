import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { logAuditAction } from "@/lib/audit";
import { sendWelcomeEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const { token, password } = await request.json();

    if (!token || !password) {
      return NextResponse.json({ error: "Token and password are required" }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters long" }, { status: 400 });
    }

    // Find valid reset/setup token
    const resetRecord = await prisma.passwordReset.findFirst({
      where: {
        token,
        expiresAt: {
          gt: new Date(),
        },
      },
    });

    if (!resetRecord) {
      return NextResponse.json(
        { error: "Invalid or expired setup token. Please request a new invitation link from your administrator." },
        { status: 400 }
      );
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email: resetRecord.email },
      include: {
        role: { select: { id: true, name: true } },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Hash password with bcrypt
    const hashedPassword = await bcrypt.hash(password, 10);

    // Update user password and activate
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });

    // Delete used setup token
    await prisma.passwordReset.delete({
      where: { id: resetRecord.id },
    });

    // Audit log
    await logAuditAction({
      userId: String(user.id),
      action: "UPDATE",
      entityType: "User",
      entityId: String(user.id),
      oldValues: JSON.stringify({ action: "onboarding_invite_pending" }),
      newValues: JSON.stringify({ action: "password_configured_and_activated" }),
      ipAddress: request.headers.get("x-forwarded-for") || "unknown",
      userAgent: request.headers.get("user-agent") || "unknown",
    });

    // Optionally send welcome notification email
    try {
      await sendWelcomeEmail(user.email, user.name);
    } catch (emailErr) {
      console.warn("Could not send welcome confirmation email:", emailErr);
    }

    return NextResponse.json({
      success: true,
      message: "Password configured successfully",
      email: user.email,
      name: user.name,
      role: user.role?.name || "CLIENT",
    });
  } catch (error) {
    console.error("Setup password error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
