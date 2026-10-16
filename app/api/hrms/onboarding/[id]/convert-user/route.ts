import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/api-auth";
import { convertCandidateToEmployee } from "@/lib/hrms/hrms-service";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;
    const onboarding = await prisma.hrmsOnboarding.findUnique({
      where: { id },
      include: { candidate: true },
    });

    if (!onboarding) {
      return NextResponse.json({ error: "Onboarding record not found" }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const { roleName, temporaryPassword } = body;

    const result = await convertCandidateToEmployee({
      candidateId: onboarding.candidateId,
      onboardingId: id,
      roleName,
      temporaryPassword,
    });

    return NextResponse.json({
      success: true,
      user: result.user,
      alreadyConverted: result.alreadyConverted,
      message: result.alreadyConverted
        ? `Employee account already existed for ${result.user.name}.`
        : `Successfully created active employee account for ${result.user.name} (${result.user.email})!`,
    });
  } catch (error: any) {
    console.error("Convert candidate error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to convert candidate to employee user" },
      { status: 500 }
    );
  }
}
