"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Briefcase,
  UserPlus,
  PlusCircle,
  CalendarPlus,
  RefreshCw,
  FileCheck,
} from "lucide-react";

interface HrmsHeaderProps {
  onNewCandidate?: () => void;
  onNewJob?: () => void;
  onScheduleInterview?: () => void;
  onPrepareOffer?: () => void;
  onRefresh?: () => void;
  activeCandidatesCount?: number;
  openingsCount?: number;
}

export function HrmsHeader({
  onNewCandidate,
  onNewJob,
  onScheduleInterview,
  onPrepareOffer,
  onRefresh,
  activeCandidatesCount = 0,
  openingsCount = 0,
}: HrmsHeaderProps) {
  return (
    <div className="flex flex-col gap-4 border-b border-border/60 pb-5 pt-1 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Briefcase className="size-5" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              Recruitment & HRMS
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="outline" className="text-xs bg-background/80 font-medium">
              {activeCandidatesCount} Candidates
            </Badge>
            <Badge variant="secondary" className="text-xs font-medium">
              {openingsCount} Active Openings
            </Badge>
          </div>
        </div>
        <p className="text-xs text-muted-foreground sm:text-sm">
          Standalone hiring pipeline, multi-interviewer scheduling, rich offer letter document generation, and onboarding conversion.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {onScheduleInterview && (
          <Button
            variant="outline"
            size="sm"
            onClick={onScheduleInterview}
            className="gap-1.5 text-xs"
          >
            <CalendarPlus className="size-3.5 text-primary" />
            <span>Schedule Interview</span>
          </Button>
        )}

        {onPrepareOffer && (
          <Button
            variant="outline"
            size="sm"
            onClick={onPrepareOffer}
            className="gap-1.5 text-xs"
          >
            <FileCheck className="size-3.5 text-teal-600" />
            <span>Prepare Offer</span>
          </Button>
        )}

        {onNewJob && (
          <Button
            variant="outline"
            size="sm"
            onClick={onNewJob}
            className="gap-1.5 text-xs"
          >
            <PlusCircle className="size-3.5 text-indigo-600" />
            <span>Post Job</span>
          </Button>
        )}

        {onNewCandidate && (
          <Button
            size="sm"
            onClick={onNewCandidate}
            className="gap-1.5 text-xs font-semibold shadow-xs"
          >
            <UserPlus className="size-3.5" />
            <span>Add Candidate</span>
          </Button>
        )}
      </div>
    </div>
  );
}
