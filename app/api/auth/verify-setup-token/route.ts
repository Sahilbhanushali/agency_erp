import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json({ valid: false, error: "Token is required" }, { status: 400 });
    }

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
        { valid: false, error: "This setup link is invalid or has expired. Please contact your agency admin for a new invite." },
        { status: 404 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: resetRecord.email },
      select: {
        id: true,
        name: true,
        email: true,
        role: { select: { name: true } },
      },
    });

    if (!user) {
      return NextResponse.json(
        { valid: false, error: "User associated with this invite could not be found." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      valid: true,
      user: {
        name: user.name,
        email: user.email,
        role: user.role?.name || "Team Member",
      },
    });
  } catch (error) {
    console.error("verify-setup-token failed:", error);
    return NextResponse.json({ valid: false, error: "Internal server error" }, { status: 500 });
  }
}
