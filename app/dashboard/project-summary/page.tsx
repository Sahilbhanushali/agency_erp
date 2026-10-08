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
import { Sparkles, FileText, CheckCircle, Clock, Edit3, Target, Calendar } from 'lucide-react';
import Link from 'next/link';

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
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 text-red-500 p-4 rounded-xl border border-red-200">
          Error: {error}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-6 py-8 space-y-6">
      <div className="relative overflow-hidden rounded-2xl bg-card/70 backdrop-blur-xl border border-border shadow-xl p-8">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/5 via-indigo-600/5 to-violet-600/5"></div>
        <div className="relative flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg">
                <FileText className="h-6 w-6 text-white" />
              </div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-foreground via-foreground/90 to-foreground bg-clip-text text-transparent">
                Project Summary
              </h1>
            </div>
            <p className="text-muted-foreground text-lg ml-14">Overview of post targets and statuses across all active projects</p>
          </div>
          
          {/* Filter Dropdown */}
          <div className="flex items-center gap-3 bg-white dark:bg-slate-900 p-2 rounded-xl border border-border shadow-sm z-10">
            <Calendar className="w-5 h-5 text-indigo-500 ml-2" />
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-[200px] border-0 shadow-none focus:ring-0 font-medium">
                <SelectValue placeholder="Select timeframe" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="font-medium cursor-pointer">All Time (Total)</SelectItem>
                {months.map((m) => (
                  <SelectItem key={m.value} value={m.value} className="font-medium cursor-pointer">
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <Card className="border-border shadow-lg rounded-2xl overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="w-16 text-center font-bold">Sr No.</TableHead>
                  <TableHead className="font-bold">Project Name</TableHead>
                  <TableHead className="text-center font-bold">Target</TableHead>
                  <TableHead className="text-center font-bold">Created</TableHead>
                  <TableHead className="text-center font-bold text-slate-700 dark:text-slate-300">Draft</TableHead>
                  <TableHead className="text-center font-bold text-yellow-700 dark:text-yellow-400">Review</TableHead>
                  <TableHead className="text-center font-bold text-blue-700 dark:text-blue-400">I Approve</TableHead>
                  <TableHead className="text-center font-bold text-green-700 dark:text-green-400">C Approve</TableHead>
                  <TableHead className="text-center font-bold text-green-800 dark:text-green-500">Posted</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                      No active projects found for this month.
                    </TableCell>
                  </TableRow>
                ) : (
                  data.map((project) => (
                    <TableRow key={project.id} className="hover:bg-muted/30 transition-colors">
                      <TableCell className="text-center font-medium text-muted-foreground">
                        {project.indexNo}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {project.image ? (
                            <img
                              src={getMediaUrl(project.image)}
                              alt={project.projectName || "Project"}
                              className="h-8 w-8 rounded-md object-cover border border-border flex-shrink-0 cursor-pointer hover:opacity-80 hover:scale-105 transition-all"
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
                            <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center border border-border text-[10px] font-semibold text-muted-foreground uppercase flex-shrink-0">
                              {project.projectName ? project.projectName.substring(0, 2) : "PR"}
                            </div>
                          )}
                          <div>
                            <Link href={`/dashboard/projects/${project.id}`} className="font-semibold text-foreground hover:text-indigo-600 transition-colors">
                              {project.projectName}
                            </Link>
                            <p className="text-xs text-muted-foreground">{project.clientName}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="bg-slate-100 dark:bg-slate-800 border-slate-200">
                          {project.target}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950 dark:text-indigo-300">
                          {project.postsCreated}
                        </Badge>
                      </TableCell>
                      
                      {/* Status Breakdown */}
                      <TableCell className="text-center">
                        <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 font-semibold">
                          {project.draft}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-400 font-semibold">
                          {project.review}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-400 font-semibold">
                          {project.approved}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400 font-semibold">
                          {project.c_approved}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-green-700 text-white dark:bg-green-800 dark:text-green-100 font-semibold shadow-sm">
                          {project.posted}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
              {data.length > 0 && (
                <tfoot className="bg-muted/80 font-bold border-t-2 border-border">
                  <TableRow>
                    <TableCell colSpan={2} className="text-right">Total</TableCell>
                    <TableCell className="text-center">{data.reduce((sum, p) => sum + p.target, 0)}</TableCell>
                    <TableCell className="text-center">{data.reduce((sum, p) => sum + p.postsCreated, 0)}</TableCell>
                    <TableCell className="text-center">{data.reduce((sum, p) => sum + p.draft, 0)}</TableCell>
                    <TableCell className="text-center">{data.reduce((sum, p) => sum + p.review, 0)}</TableCell>
                    <TableCell className="text-center">{data.reduce((sum, p) => sum + p.approved, 0)}</TableCell>
                    <TableCell className="text-center">{data.reduce((sum, p) => sum + p.c_approved, 0)}</TableCell>
                    <TableCell className="text-center">{data.reduce((sum, p) => sum + p.posted, 0)}</TableCell>
                  </TableRow>
                </tfoot>
              )}
            </Table>
          </div>
        </CardContent>
      </Card>

      <MediaPopup
        isOpen={!!selectedLogo}
        onClose={() => setSelectedLogo(null)}
        asset={selectedLogo}
      />
    </div>
  );
}
