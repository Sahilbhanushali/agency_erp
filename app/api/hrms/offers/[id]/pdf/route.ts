import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/api-auth";
import { generateOfferLetterPdf } from "@/lib/hrms/pdf-generator";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;
    const offer = await prisma.hrmsOffer.findUnique({
      where: { id },
      include: {
        candidate: true,
        jobOpening: true,
        letterhead: true,
        reportingManager: { select: { name: true } },
      },
    });

    if (!offer) {
      return NextResponse.json({ error: "Offer not found" }, { status: 404 });
    }

    const pdfBuffer = generateOfferLetterPdf({
      offerNumber: offer.offerNumber,
      candidateName: offer.candidate.name,
      candidateEmail: offer.candidate.email,
      candidatePhone: offer.candidate.phone,
      candidateAddress: offer.candidate.address,
      jobTitle: offer.jobTitle,
      department: offer.department,
      employmentType: offer.employmentType,
      workLocation: offer.workLocation,
      joiningDate: offer.joiningDate,
      probationPeriodMonths: offer.probationPeriodMonths,
      validityDate: offer.validityDate,
      annualCtc: Number(offer.annualCtc),
      monthlyGross: Number(offer.monthlyGross),
      salaryBreakdownJson: offer.salaryBreakdown,
      benefits: offer.benefits,
      additionalTerms: offer.additionalTerms,
      documentHtml: offer.documentSnapshotHtml,
      letterhead: offer.letterhead
        ? {
            companyName: offer.letterhead.companyName,
            address: offer.letterhead.address,
            email: offer.letterhead.email,
            phone: offer.letterhead.phone,
            website: offer.letterhead.website,
            primaryColor: offer.letterhead.primaryColor,
            secondaryColor: offer.letterhead.secondaryColor,
            watermarkText: offer.letterhead.watermarkText,
          }
        : null,
      offerDate: offer.createdAt,
    });

    const filename = `Offer_Letter_${offer.candidate.name.replace(/\s+/g, "_")}_${offer.offerNumber}.pdf`;

    return new NextResponse(pdfBuffer as any, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-cache",
      },
    });
  } catch (error: any) {
    console.error("Generate offer PDF error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate offer letter PDF" },
      { status: 500 }
    );
  }
}
