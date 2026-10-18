import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCan, requireSession } from "@/lib/api-auth";
import { transitionApplicationStage } from "@/lib/hrms/hrms-service";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireCan("hrms", "read");
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;
    const offer = await prisma.hrmsOffer.findUnique({
      where: { id },
      include: {
        candidate: true,
        jobOpening: true,
        template: true,
        letterhead: true,
        revisions: {
          include: {
            revisedBy: { select: { id: true, name: true, avatar: true } },
          },
          orderBy: { version: "desc" },
        },
        createdBy: { select: { id: true, name: true } },
        approvedBy: { select: { id: true, name: true } },
        onboarding: true,
      },
    });

    if (!offer) {
      return NextResponse.json({ error: "Offer not found" }, { status: 404 });
    }

    return NextResponse.json(offer);
  } catch (error: any) {
    console.error("Get offer error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch offer" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireCan("hrms", "update");
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;
    const body = await request.json();

    const existing = await prisma.hrmsOffer.findUnique({
      where: { id },
      include: { candidate: true, application: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Offer not found" }, { status: 404 });
    }

    const {
      status,
      changeReason,
      annualCtc,
      monthlyGross,
      joiningDate,
      probationPeriodMonths,
      validityDate,
      workLocation,
      documentSnapshotHtml,
      withdrawalReason,
      additionalTerms,
      benefits,
    } = body;

    const data: any = {};
    const isRevision =
      (annualCtc && Number(annualCtc) !== Number(existing.annualCtc)) ||
      (monthlyGross && Number(monthlyGross) !== Number(existing.monthlyGross)) ||
      (joiningDate && new Date(joiningDate).getTime() !== new Date(existing.joiningDate).getTime());

    // If terms are modified, retain previous version snapshot
    if (isRevision) {
      await prisma.hrmsOfferRevision.create({
        data: {
          offerId: id,
          version: existing.version,
          annualCtc: existing.annualCtc,
          monthlyGross: existing.monthlyGross,
          joiningDate: existing.joiningDate,
          changeReason: changeReason || "Offer terms revised.",
          documentSnapshotHtml: existing.documentSnapshotHtml,
          revisedById: auth.userId,
        },
      });

      data.version = existing.version + 1;
      if (annualCtc) data.annualCtc = Number(annualCtc);
      if (monthlyGross) data.monthlyGross = Number(monthlyGross);
      if (joiningDate) data.joiningDate = new Date(joiningDate);
    }

    if (probationPeriodMonths !== undefined)
      data.probationPeriodMonths = Number(probationPeriodMonths);
    if (validityDate) data.validityDate = new Date(validityDate);
    if (workLocation) data.workLocation = workLocation;
    if (documentSnapshotHtml) data.documentSnapshotHtml = documentSnapshotHtml;
    if (additionalTerms !== undefined) data.additionalTerms = additionalTerms;
    if (benefits !== undefined) data.benefits = benefits;

    // Handle status transitions
    if (status && status !== existing.status) {
      data.status = status;
      if (status === "SENT") {
        data.sentAt = new Date();
        await transitionApplicationStage({
          applicationId: existing.applicationId,
          toStage: "Offer Sent",
          performedById: auth.userId,
          notes: `Offer ${existing.offerNumber} officially issued to candidate.`,
        });
      } else if (status === "ACCEPTED") {
        data.acceptedAt = new Date();
        await transitionApplicationStage({
          applicationId: existing.applicationId,
          toStage: "Offer Accepted",
          performedById: auth.userId,
          notes: `Offer ${existing.offerNumber} accepted by candidate.`,
        });
      } else if (status === "REJECTED") {
        data.rejectedAt = new Date();
        await transitionApplicationStage({
          applicationId: existing.applicationId,
          toStage: "Offer Rejected",
          performedById: auth.userId,
          rejectionReason: changeReason || "Candidate declined offer.",
        });
      } else if (status === "WITHDRAWN") {
        data.withdrawnAt = new Date();
        data.withdrawalReason = withdrawalReason || changeReason;
        await transitionApplicationStage({
          applicationId: existing.applicationId,
          toStage: "Withdrawn",
          performedById: auth.userId,
          withdrawalReason: withdrawalReason || changeReason || "Offer withdrawn by company.",
        });
      }
    }

    const updatedOffer = await prisma.hrmsOffer.update({
      where: { id },
      data,
      include: {
        candidate: true,
        revisions: true,
      },
    });

    // Log revision activity
    if (isRevision) {
      await prisma.hrmsCandidateActivity.create({
        data: {
          candidateId: existing.candidateId,
          applicationId: existing.applicationId,
          action: "OFFER_REVISED",
          title: `Offer Revised to v${updatedOffer.version}`,
          notes: changeReason || "Revised compensation package & terms.",
          performedById: auth.userId,
        },
      });
    }

    return NextResponse.json(updatedOffer);
  } catch (error: any) {
    console.error("Update offer error:", error);
    return NextResponse.json({ error: error.message || "Failed to update offer" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireCan("hrms", "delete");
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;
    const existing = await prisma.hrmsOffer.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Offer not found" }, { status: 404 });

    // If offer was already sent or accepted, archive instead of delete
    if (existing.status !== "DRAFT") {
      await prisma.hrmsOffer.update({
        where: { id },
        data: { status: "ARCHIVED" },
      });
      return NextResponse.json({ success: true, archived: true });
    }

    await prisma.hrmsOffer.delete({ where: { id } });
    return NextResponse.json({ success: true, deleted: true });
  } catch (error: any) {
    console.error("Delete offer error:", error);
    return NextResponse.json({ error: error.message || "Failed to delete offer" }, { status: 500 });
  }
}
