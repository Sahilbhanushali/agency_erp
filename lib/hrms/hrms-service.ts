import { prisma } from "@/lib/prisma";
import { HRMS_STAGES, HrmsStage, DEFAULT_ONBOARDING_CHECKLIST } from "./types";
import { PayrollService } from "@/lib/payroll/payroll-service";
import { LeaveService } from "@/lib/payroll/leave-service";

export interface DashboardFilterParams {
  startDate?: string | null;
  endDate?: string | null;
  jobOpeningId?: string | null;
  department?: string | null;
  recruiterId?: string | number | null;
  stage?: string | null;
}

export async function getHrmsDashboardStats(filters: DashboardFilterParams = {}) {
  const applicationWhere: any = {};
  if (filters.jobOpeningId) {
    applicationWhere.jobOpeningId = filters.jobOpeningId;
  }
  if (filters.stage) {
    applicationWhere.stage = filters.stage;
  }
  if (filters.department) {
    applicationWhere.jobOpening = {
      department: filters.department,
    };
  }
  if (filters.startDate || filters.endDate) {
    applicationWhere.createdAt = {};
    if (filters.startDate) {
      applicationWhere.createdAt.gte = new Date(filters.startDate);
    }
    if (filters.endDate) {
      const end = new Date(filters.endDate);
      end.setHours(23, 59, 59, 999);
      applicationWhere.createdAt.lte = end;
    }
  }

  // 1. Total Candidates count
  const totalCandidates = await prisma.hrmsCandidate.count();

  // 2. Active Job Openings count
  const activeJobOpenings = await prisma.hrmsJobOpening.count({
    where: { status: "ACTIVE" },
  });

  // 3. Candidates count by Stage (for all 15 stages)
  const applicationsGrouped = await prisma.hrmsApplication.groupBy({
    by: ["stage"],
    where: applicationWhere,
    _count: { id: true },
  });

  const stageCounts: Record<string, number> = {};
  for (const st of HRMS_STAGES) {
    stageCounts[st] = 0;
  }
  for (const group of applicationsGrouped) {
    stageCounts[group.stage] = group._count.id;
  }

  // 4. Interviews upcoming & today
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

  const todayInterviewsCount = await prisma.hrmsInterview.count({
    where: {
      scheduledDate: {
        gte: startOfToday,
        lte: endOfToday,
      },
      status: { notIn: ["CANCELLED"] },
    },
  });

  const upcomingInterviewsCount = await prisma.hrmsInterview.count({
    where: {
      scheduledDate: {
        gte: startOfToday,
      },
      status: "SCHEDULED",
    },
  });

  // 5. Offers stats
  const pendingOffersCount = await prisma.hrmsOffer.count({
    where: {
      status: { in: ["DRAFT", "PENDING_APPROVAL", "READY_TO_SEND", "SENT"] },
    },
  });

  const acceptedOffersCount = await prisma.hrmsOffer.count({
    where: { status: "ACCEPTED" },
  });

  const rejectedOffersCount = await prisma.hrmsOffer.count({
    where: { status: "REJECTED" },
  });

  const totalDecidedOffers = acceptedOffersCount + rejectedOffersCount;
  const offerAcceptanceRate =
    totalDecidedOffers > 0
      ? Math.round((acceptedOffersCount / totalDecidedOffers) * 100)
      : acceptedOffersCount > 0
      ? 100
      : 0;

  // 6. Candidates awaiting onboarding
  const candidatesAwaitingOnboardingCount = await prisma.hrmsOnboarding.count({
    where: {
      status: { in: ["PENDING", "IN_PROGRESS"] },
    },
  });

  // 7. Recently updated candidate records
  const recentlyUpdatedCandidates = await prisma.hrmsCandidate.findMany({
    take: 6,
    orderBy: { updatedAt: "desc" },
    include: {
      applications: {
        include: {
          jobOpening: {
            select: { title: true, department: true },
          },
        },
      },
    },
  });

  // 8. Recent recruitment activities
  const recentActivities = await prisma.hrmsCandidateActivity.findMany({
    take: 8,
    orderBy: { createdAt: "desc" },
    include: {
      candidate: {
        select: { id: true, name: true, email: true },
      },
      performedBy: {
        select: { id: true, name: true, avatar: true },
      },
    },
  });

  // 9. Upcoming interviews list for today & this week
  const upcomingInterviewsList = await prisma.hrmsInterview.findMany({
    take: 5,
    where: {
      scheduledDate: { gte: startOfToday },
      status: "SCHEDULED",
    },
    orderBy: { scheduledDate: "asc" },
    include: {
      candidate: { select: { id: true, name: true, email: true } },
      jobOpening: { select: { id: true, title: true, department: true } },
      interviewers: {
        include: {
          user: { select: { id: true, name: true, avatar: true } },
        },
      },
    },
  });

  return {
    totalCandidates,
    activeJobOpenings,
    stageCounts,
    todayInterviewsCount,
    upcomingInterviewsCount,
    pendingOffersCount,
    acceptedOffersCount,
    offerAcceptanceRate,
    candidatesAwaitingOnboardingCount,
    recentlyUpdatedCandidates,
    recentActivities,
    upcomingInterviewsList,
  };
}

export async function transitionApplicationStage(options: {
  applicationId: string;
  toStage: HrmsStage;
  performedById?: number | null;
  notes?: string;
  rejectionReason?: string;
  withdrawalReason?: string;
}) {
  const application = await prisma.hrmsApplication.findUnique({
    where: { id: options.applicationId },
    include: {
      candidate: true,
      jobOpening: true,
      offers: true,
    },
  });

  if (!application) {
    throw new Error("Application not found");
  }

  const fromStage = application.stage;

  // Validation rules
  if (options.toStage === "Rejected" && !options.rejectionReason && !options.notes) {
    // Note or reason recommended
  }

  // Update status based on stage
  let status = "IN_PROGRESS";
  if (options.toStage === "Hired") status = "HIRED";
  else if (options.toStage === "Rejected" || options.toStage === "Offer Rejected") status = "REJECTED";
  else if (options.toStage === "Withdrawn") status = "WITHDRAWN";

  const updatedApplication = await prisma.hrmsApplication.update({
    where: { id: options.applicationId },
    data: {
      stage: options.toStage,
      status,
      rejectionReason: options.rejectionReason || application.rejectionReason,
      withdrawalReason: options.withdrawalReason || application.withdrawalReason,
      stageUpdatedAt: new Date(),
    },
  });

  // Create activity audit log
  await prisma.hrmsCandidateActivity.create({
    data: {
      candidateId: application.candidateId,
      applicationId: application.id,
      action: "STAGE_CHANGE",
      fromStage,
      toStage: options.toStage,
      title: `Moved to ${options.toStage}`,
      notes: options.notes || `Candidate stage updated from ${fromStage} to ${options.toStage}.`,
      performedById: options.performedById,
    },
  });

  // If moved to "Offer Accepted" or "Onboarding" or "Hired", automatically ensure an Onboarding record exists
  if (["Offer Accepted", "Onboarding", "Hired"].includes(options.toStage)) {
    const existingOnboarding = await prisma.hrmsOnboarding.findFirst({
      where: { candidateId: application.candidateId },
    });

    if (!existingOnboarding) {
      const latestOffer = application.offers[0] || null;
      const joiningDate = latestOffer?.joiningDate || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

      await prisma.hrmsOnboarding.create({
        data: {
          candidateId: application.candidateId,
          jobOpeningId: application.jobOpeningId,
          offerId: latestOffer?.id,
          joiningDate,
          status: "IN_PROGRESS",
          checklistJson: JSON.stringify(DEFAULT_ONBOARDING_CHECKLIST),
        },
      });
    }
  }

  return updatedApplication;
}

export async function convertCandidateToEmployee(options: {
  candidateId: string;
  onboardingId?: string;
  temporaryPassword?: string;
  roleName?: string;
}) {
  const candidate = await prisma.hrmsCandidate.findUnique({
    where: { id: options.candidateId },
    include: {
      applications: {
        include: {
          jobOpening: true,
          offers: { orderBy: { createdAt: "desc" }, take: 1 },
        },
      },
      onboardingRecords: true,
    },
  });

  if (!candidate) {
    throw new Error("Candidate not found");
  }

  // Check if candidate is already converted
  const existingOnboarding = candidate.onboardingRecords[0];
  if (existingOnboarding?.convertedUserId) {
    const existingUser = await prisma.user.findUnique({
      where: { id: existingOnboarding.convertedUserId },
    });
    if (existingUser) {
      return { user: existingUser, alreadyConverted: true };
    }
  }

  // Find latest application and offer
  const latestApp = candidate.applications[0];
  const latestOffer = latestApp?.offers[0];
  const jobOpening = latestApp?.jobOpening;

  // Determine designation and department
  const designation = latestOffer?.jobTitle || jobOpening?.title || "Employee";
  const department = latestOffer?.department || jobOpening?.department || "General";
  const salary = latestOffer?.monthlyGross
    ? Number(latestOffer.monthlyGross)
    : latestOffer?.annualCtc
    ? Number(latestOffer.annualCtc) / 12
    : null;
  const joiningDate = latestOffer?.joiningDate || new Date();

  // Find or create default role
  let role = await prisma.role.findFirst({
    where: { name: options.roleName || "EMPLOYEE" },
  });
  if (!role) {
    role = await prisma.role.findFirst();
  }

  // Check if a User with the candidate email already exists
  let targetUser = await prisma.user.findUnique({
    where: { email: candidate.email },
  });

  if (!targetUser) {
    targetUser = await prisma.user.create({
      data: {
        email: candidate.email,
        name: candidate.name,
        roleId: role?.id,
        phone: candidate.phone,
        address: candidate.address,
        designation,
        department,
        currentSalary: salary,
        joiningDate,
        employmentType: latestOffer?.employmentType || "FULL_TIME",
        exitStatus: "ACTIVE",
      },
    });
  } else {
    // Update existing user with designation, department and salary
    targetUser = await prisma.user.update({
      where: { id: targetUser.id },
      data: {
        designation,
        department,
        currentSalary: salary,
        joiningDate,
        phone: candidate.phone || targetUser.phone,
        address: candidate.address || targetUser.address,
        exitStatus: "ACTIVE",
      },
    });
  }

  // 1. Initialize SalaryStructure from offer / candidate compensation
  try {
    // From the salary just written to their profile, split by the default template.
    // No salary on the offer means no structure yet — not an invented ₹50,000.
    await PayrollService.assignStructureFromProfile({
      userId: targetUser.id,
      effectiveFrom: joiningDate,
      revisionReason: "Initial structure created from candidate onboarding conversion",
    });
  } catch (err: any) {
    console.warn("SalaryStructure setup warning during conversion:", err.message);
  }

  // 2. Assign default Shift & WeeklyOffPattern if not set
  try {
    const defaultShift = await prisma.shift.findFirst({ where: { isActive: true } });
    const defaultPattern = await prisma.weeklyOffPattern.findFirst({ where: { isDefault: true } });

    if (defaultShift || defaultPattern) {
      await prisma.user.update({
        where: { id: targetUser.id },
        data: {
          shiftId: defaultShift?.id || undefined,
          weeklyOffPatternId: defaultPattern?.id || undefined,
        },
      });
    }
  } catch (err: any) {
    console.warn("Shift/Pattern assignment warning:", err.message);
  }

  // 3. Initialize Leave Balances for employee
  try {
    const joinYear = new Date(joiningDate).getFullYear();
    await LeaveService.getUserBalances(targetUser.id, joinYear);
  } catch (err: any) {
    console.warn("Leave balance initialization warning:", err.message);
  }

  // Link to onboarding record
  if (existingOnboarding) {
    await prisma.hrmsOnboarding.update({
      where: { id: existingOnboarding.id },
      data: {
        convertedUserId: targetUser.id,
        status: "COMPLETED",
        completedAt: new Date(),
      },
    });
  } else {
    await prisma.hrmsOnboarding.create({
      data: {
        candidateId: candidate.id,
        jobOpeningId: jobOpening?.id,
        offerId: latestOffer?.id,
        joiningDate,
        status: "COMPLETED",
        convertedUserId: targetUser.id,
        completedAt: new Date(),
        checklistJson: JSON.stringify(DEFAULT_ONBOARDING_CHECKLIST),
      },
    });
  }

  // Update candidate status/application stage to Hired if not already
  if (latestApp && latestApp.stage !== "Hired") {
    await prisma.hrmsApplication.update({
      where: { id: latestApp.id },
      data: {
        stage: "Hired",
        status: "HIRED",
      },
    });
  }

  // Log activity
  await prisma.hrmsCandidateActivity.create({
    data: {
      candidateId: candidate.id,
      applicationId: latestApp?.id,
      action: "CONVERTED_TO_EMPLOYEE",
      title: "Converted to Employee User Account",
      notes: `Successfully created active employee account (ID: ${targetUser.id}, ${targetUser.email}) with designation "${designation}".`,
    },
  });

  return { user: targetUser, alreadyConverted: false };
}
