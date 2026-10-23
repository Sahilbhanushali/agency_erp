"use client";

import { useLiveRefresh } from "@/hooks/use-live-refresh"

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  LayoutDashboard,
  Kanban,
  Users,
  CalendarDays,
  Briefcase,
  FileCheck2,
  FileText,
  Building2,
  UserCheck,
} from "lucide-react";
import { HrmsHeader } from "@/components/hrms/hrms-header";
import { HrmsDashboardTab } from "@/components/hrms/hrms-dashboard-tab";
import { HrmsPipelineTab } from "@/components/hrms/hrms-pipeline-tab";
import { HrmsCandidatesTab } from "@/components/hrms/hrms-candidates-tab";
import { HrmsInterviewsTab } from "@/components/hrms/hrms-interviews-tab";
import { HrmsJobsTab } from "@/components/hrms/hrms-jobs-tab";
import { HrmsOffersTab } from "@/components/hrms/hrms-offers-tab";
import { HrmsTemplateEditor } from "@/components/hrms/hrms-template-editor";
import { HrmsLetterheadsTab } from "@/components/hrms/hrms-letterheads-tab";
import { HrmsOnboardingTab } from "@/components/hrms/hrms-onboarding-tab";

function HrmsPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const tabParam = searchParams.get("tab") || "overview";
  const [activeTab, setActiveTab] = useState(tabParam);

  // Cross-tab interaction states
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [interviewInitialCandidateId, setInterviewInitialCandidateId] = useState<string | null>(null);
  const [interviewInitialJobId, setInterviewInitialJobId] = useState<string | null>(null);
  const [offerInitialCandidateId, setOfferInitialCandidateId] = useState<string | null>(null);
  const [offerInitialJobId, setOfferInitialJobId] = useState<string | null>(null);

  // Counts for header badge
  const [counts, setCounts] = useState({ candidates: 0, jobs: 0 });

  const fetchHeaderCounts = async () => {
    try {
      const [candRes, jobRes] = await Promise.all([
        fetch("/api/hrms/candidates"),
        fetch("/api/hrms/jobs"),
      ]);
      if (candRes.ok && jobRes.ok) {
        const c = await candRes.json();
        const j = await jobRes.json();
        setCounts({
          candidates: Array.isArray(c) ? c.length : 0,
          jobs: Array.isArray(j) ? j.filter((item: any) => item.status === "ACTIVE").length : 0,
        });
      }
    } catch (e) {
      console.error(e);
    }
  };
  // Live: re-read when someone else changes what this shows.
  useLiveRefresh(fetchHeaderCounts, ["HrmsJobOpening", "HrmsCandidate", "HrmsApplication", "HrmsInterview", "HrmsOffer", "HrmsOnboarding"])

  useEffect(() => {
    fetchHeaderCounts();
  }, []);

  useEffect(() => {
    if (tabParam && tabParam !== activeTab) {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  const handleTabChange = (newTab: string) => {
    setActiveTab(newTab);
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", newTab);
    router.replace(`/dashboard/hrms?${params.toString()}`);
  };

  // Navigations triggered from cards
  const handleSelectCandidate = (candidateId: string) => {
    setSelectedCandidateId(candidateId);
    handleTabChange("candidates");
  };

  const handleScheduleInterview = (
    candidateId: string,
    jobOpeningId: string,
    applicationId?: string
  ) => {
    setInterviewInitialCandidateId(candidateId);
    setInterviewInitialJobId(jobOpeningId);
    handleTabChange("interviews");
  };

  const handlePrepareOffer = (
    candidateId: string,
    jobOpeningId: string,
    applicationId?: string
  ) => {
    setOfferInitialCandidateId(candidateId);
    setOfferInitialJobId(jobOpeningId);
    handleTabChange("offers");
  };


  return (
    <div className="space-y-6 p-4 sm:p-6 max-w-7xl mx-auto">
      {/* Top HRMS Header */}
      <HrmsHeader
        activeCandidatesCount={counts.candidates}
        openingsCount={counts.jobs}
        onNewCandidate={() => handleTabChange("candidates")}
        onNewJob={() => handleTabChange("jobs")}
        onScheduleInterview={() => handleTabChange("interviews")}
        onPrepareOffer={() => handleTabChange("offers")}
        onRefresh={() => {
          fetchHeaderCounts();
        }}
      />

      {/* Tabs Workspace */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full space-y-6">
        <div className="overflow-x-auto pb-1">
          <TabsList className="h-10 p-1 bg-muted/60 border border-border/60 rounded-xl inline-flex min-w-full sm:min-w-0">
            <TabsTrigger value="overview" className="gap-1.5 text-xs font-semibold px-3 py-1.5">
              <LayoutDashboard className="size-3.5" />
              <span>Dashboard</span>
            </TabsTrigger>
            <TabsTrigger value="pipeline" className="gap-1.5 text-xs font-semibold px-3 py-1.5">
              <Kanban className="size-3.5" />
              <span>Hiring Pipeline</span>
            </TabsTrigger>
            <TabsTrigger value="candidates" className="gap-1.5 text-xs font-semibold px-3 py-1.5">
              <Users className="size-3.5" />
              <span>Candidates</span>
            </TabsTrigger>
            <TabsTrigger value="interviews" className="gap-1.5 text-xs font-semibold px-3 py-1.5">
              <CalendarDays className="size-3.5" />
              <span>Interviews</span>
            </TabsTrigger>
            <TabsTrigger value="jobs" className="gap-1.5 text-xs font-semibold px-3 py-1.5">
              <Briefcase className="size-3.5" />
              <span>Job Openings</span>
            </TabsTrigger>
            <TabsTrigger value="offers" className="gap-1.5 text-xs font-semibold px-3 py-1.5">
              <FileCheck2 className="size-3.5" />
              <span>Offers</span>
            </TabsTrigger>
            <TabsTrigger value="templates" className="gap-1.5 text-xs font-semibold px-3 py-1.5">
              <FileText className="size-3.5" />
              <span>Offer Templates</span>
            </TabsTrigger>
            <TabsTrigger value="letterheads" className="gap-1.5 text-xs font-semibold px-3 py-1.5">
              <Building2 className="size-3.5" />
              <span>Letterheads</span>
            </TabsTrigger>
            <TabsTrigger value="onboarding" className="gap-1.5 text-xs font-semibold px-3 py-1.5">
              <UserCheck className="size-3.5" />
              <span>Onboarding</span>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Tab 1: Overview Dashboard */}
        <TabsContent value="overview" className="mt-0 outline-hidden">
          <HrmsDashboardTab
            onNavigateTab={handleTabChange}
            onSelectCandidate={handleSelectCandidate}
          />
        </TabsContent>

        {/* Tab 2: Hiring Pipeline Kanban */}
        <TabsContent value="pipeline" className="mt-0 outline-hidden">
          <HrmsPipelineTab
            onSelectCandidate={handleSelectCandidate}
            onScheduleInterview={handleScheduleInterview}
            onPrepareOffer={handlePrepareOffer}
          />
        </TabsContent>

        {/* Tab 3: Candidates Directory */}
        <TabsContent value="candidates" className="mt-0 outline-hidden">
          <HrmsCandidatesTab
            selectedCandidateId={selectedCandidateId}
            onCloseSelectedCandidate={() => setSelectedCandidateId(null)}
            onScheduleInterview={handleScheduleInterview}
            onPrepareOffer={handlePrepareOffer}
          />
        </TabsContent>

        {/* Tab 4: Interviews Scheduler & Calendar */}
        <TabsContent value="interviews" className="mt-0 outline-hidden">
          <HrmsInterviewsTab
            initialScheduleCandidateId={interviewInitialCandidateId}
            initialJobOpeningId={interviewInitialJobId}
            onClearInitialSchedule={() => {
              setInterviewInitialCandidateId(null);
              setInterviewInitialJobId(null);
            }}
          />
        </TabsContent>

        {/* Tab 5: Job Openings */}
        <TabsContent value="jobs" className="mt-0 outline-hidden">
          <HrmsJobsTab
            onSelectJobForCandidates={(jobId) => {
              handleTabChange("candidates");
            }}
          />
        </TabsContent>

        {/* Tab 6: Offers */}
        <TabsContent value="offers" className="mt-0 outline-hidden">
          <HrmsOffersTab
            initialCandidateId={offerInitialCandidateId}
            initialJobOpeningId={offerInitialJobId}
            onClearInitialOffer={() => {
              setOfferInitialCandidateId(null);
              setOfferInitialJobId(null);
            }}
          />
        </TabsContent>

        {/* Tab 7: Offer Letter Template Editor */}
        <TabsContent value="templates" className="mt-0 outline-hidden">
          <HrmsTemplateEditor />
        </TabsContent>

        {/* Tab 8: Branded Letterheads */}
        <TabsContent value="letterheads" className="mt-0 outline-hidden">
          <HrmsLetterheadsTab />
        </TabsContent>

        {/* Tab 9: Onboarding Workflow & Employee Conversion */}
        <TabsContent value="onboarding" className="mt-0 outline-hidden">
          <HrmsOnboardingTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function HrmsPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6 p-6 max-w-7xl mx-auto">
          <div className="flex items-center justify-between border-b pb-5">
            <div className="space-y-2">
              <Skeleton className="h-7 w-48" />
              <Skeleton className="h-4 w-96" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-9 w-28" />
              <Skeleton className="h-9 w-28" />
            </div>
          </div>
          <Skeleton className="h-10 w-full rounded-xl" />
          <div className="grid grid-cols-4 gap-4">
            <Skeleton className="h-28 rounded-xl" />
            <Skeleton className="h-28 rounded-xl" />
            <Skeleton className="h-28 rounded-xl" />
            <Skeleton className="h-28 rounded-xl" />
          </div>
        </div>
      }
    >
      <HrmsPageContent />
    </Suspense>
  );
}
