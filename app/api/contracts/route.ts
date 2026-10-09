import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/api-auth";
import { logAuditAction } from "@/lib/audit";
import { contractSchema } from "@/lib/validation/contract";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requirePermission("View-clients");
  if (!auth.ok) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get("clientId");
    const status = searchParams.get("status");
    const type = searchParams.get("type");
    const search = searchParams.get("search")?.trim().toLowerCase();

    const where: any = {};

    if (clientId) where.clientId = clientId;
    if (status && status !== "ALL") where.status = status;
    if (type && type !== "ALL") where.type = type;

    if (search) {
      where.OR = [
        { title: { contains: search } },
        { contractNumber: { contains: search } },
        { client: { name: { contains: search } } },
      ];
    }

    const contracts = await prisma.contract.findMany({
      where,
      include: {
        client: {
          select: {
            id: true,
            name: true,
            company: true,
            email: true,
            avatar: true,
          },
        },
        project: {
          select: {
            id: true,
            name: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Check for expiring contracts (within 30 days) and update status dynamically
    const now = new Date();
    const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 3600 * 1000);

    let activeRetainers = 0;
    let monthlyRetainerValue = 0;
    let expiringCount = 0;

    for (const c of contracts) {
      if (c.status === "ACTIVE" && c.type === "RETAINER") {
        activeRetainers++;
        if (c.billingCycle === "MONTHLY") {
          monthlyRetainerValue += Number(c.value);
        }
      }

      if (
        c.renewalDate &&
        new Date(c.renewalDate) <= thirtyDaysFromNow &&
        new Date(c.renewalDate) >= now &&
        c.status === "ACTIVE"
      ) {
        expiringCount++;
      }
    }

    return NextResponse.json({
      contracts,
      metrics: {
        totalContracts: contracts.length,
        activeRetainers,
        monthlyRetainerValue,
        expiringCount,
      },
    });
  } catch (error) {
    console.error("[contracts] GET failed:", error);
    return NextResponse.json({ error: "Failed to load contracts" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requirePermission("Manage-clients");
  if (!auth.ok) return auth.response;

  try {
    const json = await request.json();
    const parsed = contractSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 422 }
      );
    }

    const data = parsed.data;

    // Generate sequential contract number if not provided
    let contractNumber = data.contractNumber;
    if (!contractNumber) {
      const year = new Date().getFullYear();
      const count = await prisma.contract.count({
        where: {
          createdAt: {
            gte: new Date(`${year}-01-01`),
          },
        },
      });
      contractNumber = `CNT-${year}-${String(count + 1).padStart(4, "0")}`;
    }

    const contract = await prisma.contract.create({
      data: {
        clientId: data.clientId,
        projectId: data.projectId,
        createdById: auth.userId,
        contractNumber,
        title: data.title,
        type: data.type,
        status: data.status,
        value: data.value,
        currency: data.currency,
        billingCycle: data.billingCycle,
        startDate: new Date(data.startDate),
        endDate: data.endDate ? new Date(data.endDate) : null,
        renewalDate: data.renewalDate ? new Date(data.renewalDate) : null,
        autoRenew: data.autoRenew,
        noticePeriodDays: data.noticePeriodDays,
        retainerHours: data.retainerHours,
        deliverableQuota: data.deliverableQuota || null,
        documentUrl: data.documentUrl,
        signedAt: data.signedAt ? new Date(data.signedAt) : null,
        signedBy: data.signedBy,
        notes: data.notes,
      },
      include: {
        client: { select: { id: true, name: true } },
        project: { select: { id: true, name: true } },
      },
    });

    await logAuditAction({
      userId: String(auth.userId),
      action: "CREATE",
      entityType: "Contract",
      entityId: contract.id,
      newValues: JSON.stringify({
        title: contract.title,
        type: contract.type,
        value: contract.value,
        clientId: contract.clientId,
      }),
      ipAddress: request.headers.get("x-forwarded-for") || "unknown",
      userAgent: request.headers.get("user-agent") || "unknown",
    });

    return NextResponse.json({ contract }, { status: 201 });
  } catch (error) {
    console.error("[contracts] POST failed:", error);
    return NextResponse.json({ error: "Failed to create contract" }, { status: 500 });
  }
}
