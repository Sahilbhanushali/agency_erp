'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Sparkles, FileText, CheckCircle, Clock, Edit3, Target, Calendar, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getMediaUrl } from '@/lib/utils';
import MediaPopup from '@/components/mediaPopup';

interface ProjectSummary {
  id: string;
  indexNo: number;
  projectName: string;
  clientName: string;
  image?: string | null;
  target: number;
  postsCreated: number;
  posted: number;
  approved: number;
  c_approved: number;
  review: number;
  draft: number;
  remaining: number;
}

export default function ProjectSummaryPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [data, setData] = useState<ProjectSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const now = new Date();
  const currentMonthValue = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [filter, setFilter] = useState<string>(currentMonthValue);
  const [selectedLogo, setSelectedLogo] = useState<{ url: string; filename: string; type: string } | null>(null);

  // Generate last 12 months for the dropdown
  const months = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    months.push({ value, label });
  }

  useEffect(() => {
    if (status === 'loading') return;

    if (!session || !session.user) {
      router.push('/auth/signin');
      return;
    }

    async function fetchSummary() {
      try {
        setIsLoading(true);
        const response = await fetch(`/api/projects/summary?filter=${filter}`);
        if (!response.ok) {
          throw new Error('Failed to fetch project summary data');
        }
        const result = await response.json();
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setIsLoading(false);
      }
    }

    fetchSummary();
  }, [session, status, router, filter]);

  if (status === 'loading' || isLoading) {
    return (
      <div className="space-y-6 animate-in fade-in-50 duration-200">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="rounded-xl border border-border/70 bg-card p-6 shadow-2xs">
          <div className="space-y-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-border/70 bg-card p-12 text-center shadow-2xs">
        <AlertCircle className="size-10 text-destructive mx-auto mb-3" />
        <h3 className="text-base font-semibold text-foreground mb-1">Error Loading Summary</h3>
        <p className="text-xs text-muted-foreground mb-4 max-w-md mx-auto">{error}</p>
        <Button size="sm" onClick={() => window.location.reload()}>
          Try Again
        </Button>
      </div>
    );
  }

  const totalTargets = data.reduce((sum, p) => sum + p.target, 0);
  const totalCreated = data.reduce((sum, p) => sum + p.postsCreated, 0);
  const totalPosted = data.reduce((sum, p) => sum + p.posted, 0);

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Project Summary</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Overview of deliverables, target counts, and publishing progress across active retainers.
          </p>
        </div>

        {/* Filter Dropdown */}
        <div className="flex items-center gap-2">
          <Calendar className="size-4 text-muted-foreground" />
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="h-9 w-[190px] bg-card text-xs">
              <SelectValue placeholder="Select timeframe" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs font-medium cursor-pointer">All Time (Total)</SelectItem>
              {months.map((m) => (
                <SelectItem key={m.value} value={m.value} className="text-xs font-medium cursor-pointer">
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Quick Stat Chips */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:w-fit">
        <div className="flex items-center gap-3 rounded-lg border border-border/70 bg-card px-3.5 py-2 shadow-2xs">
          <div className="size-2 rounded-full bg-primary" />
          <div className="flex flex-col">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Total Projects</span>
            <span className="text-base font-bold tabular-nums text-foreground">{data.length}</span>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-lg border border-border/70 bg-card px-3.5 py-2 shadow-2xs">
          <div className="size-2 rounded-full bg-blue-500" />
          <div className="flex flex-col">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Target Deliverables</span>
            <span className="text-base font-bold tabular-nums text-foreground">{totalTargets}</span>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-lg border border-border/70 bg-card px-3.5 py-2 shadow-2xs">
          <div className="size-2 rounded-full bg-emerald-500" />
          <div className="flex flex-col">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Posts Created</span>
            <span className="text-base font-bold tabular-nums text-foreground">{totalCreated}</span>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-lg border border-border/70 bg-card px-3.5 py-2 shadow-2xs">
          <div className="size-2 rounded-full bg-amber-500" />
          <div className="flex flex-col">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Total Published</span>
            <span className="text-base font-bold tabular-nums text-foreground">{totalPosted}</span>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border/70 bg-card shadow-2xs">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-12 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">#</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Project</TableHead>
              <TableHead className="text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">Target</TableHead>
              <TableHead className="text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">Created</TableHead>
              <TableHead className="text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">Draft</TableHead>
              <TableHead className="text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">Review</TableHead>
              <TableHead className="text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">I Approve</TableHead>
              <TableHead className="text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">C Approve</TableHead>
              <TableHead className="text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">Posted</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-12 text-xs text-muted-foreground">
                  No active projects found for this timeframe.
                </TableCell>
              </TableRow>
            ) : (
              data.map((project) => (
                <TableRow key={project.id} className="hover:bg-muted/40 transition-colors">
                  <TableCell className="text-center font-medium text-xs text-muted-foreground tabular-nums">
                    {project.indexNo}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      {project.image ? (
                        <img
                          src={getMediaUrl(project.image)}
                          alt={project.projectName || "Project"}
                          className="size-8 rounded-md object-cover border border-border shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedLogo({
                              url: getMediaUrl(project.image!),
                              filename: project.image!.split("/").pop() || `${project.projectName || "Project"}.jpg`,
                              type: "image",
                            });
                          }}
                          title="Click to view logo"
                        />
                      ) : (
                        <div className="size-8 rounded-md bg-muted flex items-center justify-center border border-border text-[10px] font-semibold text-muted-foreground uppercase shrink-0">
                          {project.projectName ? project.projectName.substring(0, 2) : "PR"}
                        </div>
                      )}
                      <div className="flex flex-col min-w-0">
                        <Link href={`/dashboard/projects/${project.id}`} className="font-semibold text-xs text-foreground hover:text-primary transition-colors truncate">
                          {project.projectName}
                        </Link>
                        <span className="text-[11px] text-muted-foreground truncate">{project.clientName}</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline" className="tabular-nums font-mono text-xs">
                      {project.target}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="secondary" className="tabular-nums font-semibold text-xs">
                      {project.postsCreated}
                    </Badge>
                  </TableCell>
                  
                  {/* Status Breakdown with tabular-nums */}
                  <TableCell className="text-center">
                    <span className="inline-flex items-center justify-center size-7 rounded-md bg-muted text-foreground text-xs font-semibold tabular-nums">
                      {project.draft}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="inline-flex items-center justify-center size-7 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-semibold tabular-nums">
                      {project.review}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="inline-flex items-center justify-center size-7 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-semibold tabular-nums">
                      {project.approved}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="inline-flex items-center justify-center size-7 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-semibold tabular-nums">
                      {project.c_approved}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="inline-flex items-center justify-center size-7 rounded-md bg-primary text-primary-foreground text-xs font-semibold tabular-nums shadow-2xs">
                      {project.posted}
                    </span>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
          {data.length > 0 && (
            <tfoot className="bg-muted/50 font-bold border-t border-border/80">
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={2} className="text-right text-xs uppercase tracking-wider font-semibold text-foreground">Totals</TableCell>
                <TableCell className="text-center tabular-nums text-xs font-bold">{totalTargets}</TableCell>
                <TableCell className="text-center tabular-nums text-xs font-bold text-primary">{totalCreated}</TableCell>
                <TableCell className="text-center tabular-nums text-xs">{data.reduce((sum, p) => sum + p.draft, 0)}</TableCell>
                <TableCell className="text-center tabular-nums text-xs text-amber-600">{data.reduce((sum, p) => sum + p.review, 0)}</TableCell>
                <TableCell className="text-center tabular-nums text-xs text-blue-600">{data.reduce((sum, p) => sum + p.approved, 0)}</TableCell>
                <TableCell className="text-center tabular-nums text-xs text-emerald-600">{data.reduce((sum, p) => sum + p.c_approved, 0)}</TableCell>
                <TableCell className="text-center tabular-nums text-xs font-bold text-primary">{totalPosted}</TableCell>
              </TableRow>
            </tfoot>
          )}
        </Table>
      </div>

      <MediaPopup
        isOpen={!!selectedLogo}
        onClose={() => setSelectedLogo(null)}
        asset={selectedLogo}
      />
    </div>
  );
}
