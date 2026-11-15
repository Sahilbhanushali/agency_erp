import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCan } from "@/lib/api-auth";
import { logAuditAction } from "@/lib/audit";
import { clientIp } from "@/lib/rate-limit"

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireCan("contracts", "create");
  if (!auth.ok) return auth.response;

  try {
    const { id } = await context.params;
    const contract = await prisma.contract.findUnique({
      where: { id },
      include: { client: { select: { name: true } } },
    });

    if (!contract) {
      return NextResponse.json({ error: "Contract not found" }, { status: 404 });
    }

    const currentRenewal = contract.renewalDate || contract.endDate || contract.startDate;
    const newStartDate = new Date(currentRenewal);
    const newEndDate = new Date(newStartDate);
    const newRenewalDate = new Date(newStartDate);

    switch (contract.billingCycle) {
      case "ANNUALLY":
        newEndDate.setFullYear(newEndDate.getFullYear() + 1);
        newRenewalDate.setFullYear(newRenewalDate.getFullYear() + 1);
        break;
      case "QUARTERLY":
        newEndDate.setMonth(newEndDate.getMonth() + 3);
        newRenewalDate.setMonth(newRenewalDate.getMonth() + 3);
        break;
      case "MONTHLY":
      default:
        newEndDate.setMonth(newEndDate.getMonth() + 1);
        newRenewalDate.setMonth(newRenewalDate.getMonth() + 1);
        break;
    }

    const renewed = await prisma.contract.update({
      where: { id },
      data: {
        status: "ACTIVE",
        startDate: newStartDate,
        endDate: newEndDate,
        renewalDate: newRenewalDate,
        reminderSent: false,
      },
    });

    await logAuditAction({
      userId: String(auth.userId),
      action: "UPDATE",
      entityType: "Contract",
      entityId: id,
      oldValues: JSON.stringify({ action: "renew_initiated", priorRenewal: currentRenewal }),
      newValues: JSON.stringify({
        action: "renew_completed",
        startDate: newStartDate,
        renewalDate: newRenewalDate,
        status: "ACTIVE",
      }),
      ipAddress: clientIp(request.headers) || "unknown",
      userAgent: request.headers.get("user-agent") || "unknown",
    });

    return NextResponse.json({
      success: true,
      contract: renewed,
      message: `Retainer renewed until ${newRenewalDate.toLocaleDateString("en-GB")}`,
    });
  } catch (error) {
    console.error("[contracts] renew failed:", error);
    return NextResponse.json({ error: "Failed to renew contract" }, { status: 500 });
  }
}
