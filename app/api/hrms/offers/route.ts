import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCan, requireSession } from "@/lib/api-auth";
import { resolvePlaceholders } from "@/lib/hrms/placeholder-engine";


export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireCan("hrms", "read");
  if (!auth.ok) return auth.response;

  // The requireCan() above already accepts this module's canonical permission and
  // every legacy name that implies it. A second exact-match check on the legacy name
  // alone could only ever reject roles the first call had just allowed — which is
  // what it did to any role configured in the permission matrix.

  try {
    const { searchParams } = new URL(request.url);
    const candidateId = searchParams.get("candidateId");
    const jobOpeningId = searchParams.get("jobOpeningId");
    const status = searchParams.get("status");

    const where: any = {};
    if (candidateId) where.candidateId = candidateId;
    if (jobOpeningId && jobOpeningId !== "ALL") where.jobOpeningId = jobOpeningId;
    if (status && status !== "ALL") where.status = status;

    const offers = await prisma.hrmsOffer.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        candidate: { select: { id: true, name: true, email: true, phone: true } },
        jobOpening: { select: { id: true, title: true, department: true } },
        template: { select: { id: true, name: true } },
        letterhead: { select: { id: true, name: true, companyName: true } },
        revisions: { orderBy: { version: "desc" } },
        onboarding: { select: { id: true, status: true } },
      },
    });

    return NextResponse.json(offers);
  } catch (error: any) {
    console.error("Fetch offers error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch offers" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireCan("hrms", "create");
  if (!auth.ok) return auth.response;


  try {
    const body = await request.json();
    const {
      candidateId,
      jobOpeningId,
      applicationId,
      templateId,
      letterheadId,
      jobTitle,
      department,
      reportingManagerId,
      employmentType,
      workLocation,
      joiningDate,
      probationPeriodMonths,
      validityDate,
      annualCtc,
      monthlyGross,
      salaryBreakdown,
      benefits,
      additionalTerms,
      status, // "DRAFT" | "READY_TO_SEND" | "SENT"
    } = body;

    if (!candidateId || !jobOpeningId || !annualCtc || !joiningDate || !validityDate) {
      return NextResponse.json(
        { error: "Candidate, job, annual CTC, joining date, and validity date are required" },
        { status: 400 }
      );
    }

    // Candidate details
    const candidate = await prisma.hrmsCandidate.findUnique({
      where: { id: candidateId },
    });
    if (!candidate) return NextResponse.json({ error: "Candidate not found" }, { status: 404 });

    // Job details
    const job = await prisma.hrmsJobOpening.findUnique({
      where: { id: jobOpeningId },
    });

    // Application
    let app = null;
    if (applicationId) {
      app = await prisma.hrmsApplication.findUnique({ where: { id: applicationId } });
    }
    if (!app) {
      app = await prisma.hrmsApplication.findFirst({
        where: { candidateId, jobOpeningId },
      });
    }
    if (!app) {
      app = await prisma.hrmsApplication.create({
        data: {
          candidateId,
          jobOpeningId,
          stage: "Offer Preparation",
          status: "IN_PROGRESS",
        },
      });
    }

    // Template & Letterhead
    const template = templateId
      ? await prisma.hrmsOfferTemplate.findUnique({ where: { id: templateId } })
      : await prisma.hrmsOfferTemplate.findFirst({ where: { status: "ACTIVE" } });

    const letterhead = letterheadId
      ? await prisma.hrmsLetterhead.findUnique({ where: { id: letterheadId } })
      : await prisma.hrmsLetterhead.findFirst({ where: { isDefault: true } }) ||
        await prisma.hrmsLetterhead.findFirst();

    // Reporting manager name
    let reportingManagerName = null;
    if (reportingManagerId) {
      const rm = await prisma.user.findUnique({ where: { id: Number(reportingManagerId) } });
      reportingManagerName = rm?.name;
    }

    // Generate unique Offer Number
    const countOffers = await prisma.hrmsOffer.count();
    const offerNumber = `OFF-${new Date().getFullYear()}-${String(countOffers + 1).padStart(4, "0")}`;

    const annualCtcNum = Number(annualCtc);
    const monthlyGrossNum = monthlyGross ? Number(monthlyGross) : Math.round(annualCtcNum / 12);

    // Resolve snapshot HTML if template exists
    let documentSnapshotHtml = null;
    if (template?.contentHtml) {
      const resolved = resolvePlaceholders(
        template.contentHtml,
        {
          candidate: {
            name: candidate.name,
            email: candidate.email,
            phone: candidate.phone,
            address: candidate.address,
          },
          job: {
            title: jobTitle || job?.title,
            department: department || job?.department,
            employmentType: employmentType || "Full-Time",
            location: workLocation || job?.location,
          },
          offer: {
            annualCtc: annualCtcNum,
            monthlyGross: monthlyGrossNum,
            joiningDate,
            probationPeriodMonths: probationPeriodMonths ? Number(probationPeriodMonths) : 3,
            validityDate,
            reportingManagerName,
            salaryBreakdownJson: typeof salaryBreakdown === "string" ? salaryBreakdown : JSON.stringify(salaryBreakdown),
            offerDate: new Date(),
          },
          letterhead: letterhead
            ? {
                companyName: letterhead.companyName,
                address: letterhead.address,
                email: letterhead.email,
                logoUrl: letterhead.logoUrl,
              }
            : undefined,
        },
        false
      );
      documentSnapshotHtml = resolved.renderedHtml;
    }

    const offerStatus = status || "DRAFT";

    const offer = await prisma.hrmsOffer.create({
      data: {
        offerNumber,
        applicationId: app.id,
        candidateId,
        jobOpeningId,
        templateId: template?.id,
        letterheadId: letterhead?.id,
        jobTitle: (jobTitle || job?.title || "Employee").trim(),
        department: (department || job?.department || "General").trim(),
        reportingManagerId: reportingManagerId ? Number(reportingManagerId) : null,
        employmentType: employmentType || "FULL_TIME",
        workLocation: workLocation || job?.location || "HQ",
        joiningDate: new Date(joiningDate),
        probationPeriodMonths: probationPeriodMonths ? Number(probationPeriodMonths) : 3,
        validityDate: new Date(validityDate),
        annualCtc: annualCtcNum,
        monthlyGross: monthlyGrossNum,
        salaryBreakdown: typeof salaryBreakdown === "string" ? salaryBreakdown : JSON.stringify(salaryBreakdown),
        benefits,
        additionalTerms,
        status: offerStatus,
        version: 1,
        documentSnapshotHtml,
        createdById: auth.userId,
        sentAt: offerStatus === "SENT" ? new Date() : null,
      },
    });

    // Update application stage
    const nextStage = offerStatus === "SENT" ? "Offer Sent" : "Offer Preparation";
    await prisma.hrmsApplication.update({
      where: { id: app.id },
      data: {
        stage: nextStage,
        stageUpdatedAt: new Date(),
      },
    });

    // Activity log
    await prisma.hrmsCandidateActivity.create({
      data: {
        candidateId,
        applicationId: app.id,
        action: offerStatus === "SENT" ? "OFFER_SENT" : "OFFER_CREATED",
        fromStage: app.stage,
        toStage: nextStage,
        title: `Offer ${offerStatus === "SENT" ? "Sent" : "Prepared"} (${offerNumber})`,
        notes: `Annual CTC: ₹ ${annualCtcNum.toLocaleString("en-IN")}, Position: ${offer.jobTitle}.`,
        performedById: auth.userId,
      },
    });

    return NextResponse.json(offer, { status: 201 });
  } catch (error: any) {
    console.error("Create offer error:", error);
    return NextResponse.json({ error: error.message || "Failed to prepare offer" }, { status: 500 });
  }
}
