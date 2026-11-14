"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List,
  ListOrdered,
  Heading1,
  Heading2,
  Heading3,
  Table,
  Plus,
  Undo,
  Redo,
  Save,
  Eye,
  FileDown,
  Copy,
  Archive,
  RotateCcw,
  Sparkles,
  Trash2,
  Code,
  Search,
  CheckCircle,
  AlertCircle,
  FileText,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Printer,
  ChevronDown,
  Layers,
  Check,
  X,
} from "lucide-react";
import { PLACEHOLDERS, PlaceholderDefinition } from "@/lib/hrms/types";
import { resolvePlaceholders, generateSalaryBreakdownTable } from "@/lib/hrms/placeholder-engine";
import toast from "react-hot-toast";

interface Template {
  id: string;
  name: string;
  description?: string | null;
  category: string;
  department?: string | null;
  employmentType?: string | null;
  status: string;
  version: number;
  contentHtml: string;
  letterheadId?: string | null;
  createdAt: string;
  updatedAt: string;
  letterhead?: { id: string; name: string; companyName: string; headerHtml?: string; footerHtml?: string } | null;
}

interface TemplateBlockDef {
  key: string;
  name: string;
  category: "Compensation" | "Legal & Compliance" | "Terms" | "Signatures";
  description: string;
  isMatch: (html: string) => boolean;
  remove: (html: string) => string;
  defaultHtml: string;
}

const TEMPLATE_BLOCKS: TemplateBlockDef[] = [
  {
    key: "salary_breakdown",
    name: "Salary Breakdown Table",
    category: "Compensation",
    description: "Itemized Cost-to-Company (CTC) table displaying Basic, HRA, Allowances, PF, ESI, and Net Pay.",
    isMatch: (html) => html.includes("{{salary_breakdown}}"),
    remove: (html) =>
      html
        .replace(/<div[^>]*data-block=["']salary_breakdown["'][^>]*>[\s\S]*?<\/div>/gi, "")
        .replace(/<p[^>]*>\s*{{salary_breakdown}}\s*<\/p>/gi, "")
        .replace(/{{salary_breakdown}}/g, ""),
    defaultHtml: `<p>{{salary_breakdown}}</p>`,
  },
  {
    key: "signature_block",
    name: "Signatures & Acceptance Block",
    category: "Signatures",
    description: "Side-by-side formal execution block for authorized company signatory and candidate signature.",
    isMatch: (html) =>
      html.includes("Candidate Signature") ||
      html.includes("Candidate Acceptance") ||
      html.includes("authorized_signatory") ||
      html.includes("data-block=\"signature\""),
    remove: (html) =>
      html
        .replace(/<table[^>]*>[\s\S]*?(?:Candidate Signature|Candidate Acceptance|authorized_signatory)[\s\S]*?<\/table>/gi, "")
        .replace(/<div[^>]*data-block=["']signature["'][^>]*>[\s\S]*?<\/div>/gi, ""),
    defaultHtml: `<table style="width: 100%; margin-top: 36px; border-collapse: collapse;">
  <tr>
    <td style="width: 50%; vertical-align: top;">
      <p style="font-size: 13px; font-weight: bold; margin: 0 0 40px 0;">For {{company_name}}</p>
      <div style="border-top: 1px solid #94a3b8; width: 180px; padding-top: 4px;">
        <p style="font-size: 12px; font-weight: 600; margin: 0;">{{authorized_signatory}}</p>
      </div>
    </td>
    <td style="width: 50%; vertical-align: top;">
      <p style="font-size: 13px; font-weight: bold; margin: 0 0 40px 0;">Candidate Signature</p>
      <div style="border-top: 1px solid #94a3b8; width: 180px; padding-top: 4px;">
        <p style="font-size: 12px; font-weight: 600; margin: 0;">{{candidate_name}}</p>
        <p style="font-size: 11px; color: #64748b; margin: 0;">Date: ________________</p>
      </div>
    </td>
  </tr>
</table>`,
  },
  {
    key: "probation_clause",
    name: "Probation & Confirmation Clause",
    category: "Terms",
    description: "Standard 3-month probation terms and written confirmation criteria.",
    isMatch: (html) => /probation period/i.test(html) || /data-block=["']probation["']/i.test(html),
    remove: (html) =>
      html
        .replace(/<div[^>]*data-block=["']probation["'][^>]*>[\s\S]*?<\/div>/gi, "")
        .replace(/<h[1-6][^>]*>[^<]*probation[^<]*<\/h[1-6]>\s*(?:<p[^>]*>[\s\S]*?<\/p>)?/gi, ""),
    defaultHtml: `<div data-block="probation">
<h3>3. Probation Period</h3>
<p>You will be on probation for an initial period of <strong>3 months</strong> from your date of joining. Upon successful evaluation of performance, your employment will be confirmed in writing.</p>
</div>`,
  },
  {
    key: "notice_clause",
    name: "Notice Period & Separation Terms",
    category: "Terms",
    description: "Notice period durations during probation (15 days) and after confirmation (30 days).",
    isMatch: (html) => /notice period/i.test(html) || /data-block=["']notice_period["']/i.test(html),
    remove: (html) =>
      html
        .replace(/<div[^>]*data-block=["']notice_period["'][^>]*>[\s\S]*?<\/div>/gi, "")
        .replace(/<h[1-6][^>]*>[^<]*notice period[^<]*<\/h[1-6]>\s*(?:<p[^>]*>[\s\S]*?<\/p>)?/gi, ""),
    defaultHtml: `<div data-block="notice_period">
<h3>4. Notice Period & Termination</h3>
<p>During probation, either party may terminate employment by giving <strong>15 days' written notice</strong> or salary in lieu. Following confirmation, the required notice period shall be <strong>30 days</strong>.</p>
</div>`,
  },
  {
    key: "confidentiality_clause",
    name: "Confidentiality & IP Clause",
    category: "Legal & Compliance",
    description: "Protection of intellectual property, proprietary software codebase, and trade secrets.",
    isMatch: (html) => /confidentiality/i.test(html) || /data-block=["']confidentiality["']/i.test(html),
    remove: (html) =>
      html
        .replace(/<div[^>]*data-block=["']confidentiality["'][^>]*>[\s\S]*?<\/div>/gi, "")
        .replace(/<h[1-6][^>]*>[^<]*(?:confidentiality|non-disclosure)[^<]*<\/h[1-6]>\s*(?:<p[^>]*>[\s\S]*?<\/p>)?/gi, ""),
    defaultHtml: `<div data-block="confidentiality">
<h3>5. Confidentiality & Non-Disclosure</h3>
<p>You agree to maintain strict confidentiality regarding all proprietary information, software codebase, client materials, and trade secrets of {{company_name}} during and indefinitely following your tenure.</p>
</div>`,
  },
  {
    key: "working_hours_clause",
    name: "Working Hours & Location",
    category: "Terms",
    description: "Official work timing schedule, weekly off days, and work location provisions.",
    isMatch: (html) => /working hours/i.test(html) || /place of work/i.test(html) || /data-block=["']working_hours["']/i.test(html),
    remove: (html) =>
      html
        .replace(/<div[^>]*data-block=["']working_hours["'][^>]*>[\s\S]*?<\/div>/gi, "")
        .replace(/<h[1-6][^>]*>[^<]*(?:working hours|place of work)[^<]*<\/h[1-6]>\s*(?:<p[^>]*>[\s\S]*?<\/p>)?/gi, ""),
    defaultHtml: `<div data-block="working_hours">
<h3>6. Working Hours & Place of Work</h3>
<p>Standard working hours are 9:30 AM to 6:30 PM, Monday through Friday. Your primary location of work will be the company registered office or approved hybrid schedule.</p>
</div>`,
  },
  {
    key: "validity_clause",
    name: "Offer Validity & Acceptance Clause",
    category: "Legal & Compliance",
    description: "Expiry date of the offer and formal acceptance acknowledgment deadline.",
    isMatch: (html) => /offer validity/i.test(html) || /remains valid until/i.test(html) || /data-block=["']validity["']/i.test(html),
    remove: (html) =>
      html
        .replace(/<div[^>]*data-block=["']validity["'][^>]*>[\s\S]*?<\/div>/gi, "")
        .replace(/<h[1-6][^>]*>[^<]*(?:offer validity|acceptance)[^<]*<\/h[1-6]>\s*(?:<p[^>]*>[\s\S]*?<\/p>)?/gi, ""),
    defaultHtml: `<div data-block="validity">
<h3>7. Offer Validity & Acceptance</h3>
<p>This employment offer remains valid until <strong>{{offer_expiry_date}}</strong>. Kindly sign and return a duplicate copy to confirm your acceptance.</p>
</div>`,
  },
];

export function HrmsTemplateEditor() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [letterheads, setLetterheads] = useState<any[]>([]);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Active Template
  const [activeTemplate, setActiveTemplate] = useState<Template | null>(null);
  const [isEditingNew, setIsEditingNew] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Template Blocks Management Modal
  const [isBlockModalOpen, setIsBlockModalOpen] = useState(false);

  // Meta fields
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("STANDARD");
  const [letterheadId, setLetterheadId] = useState("");
  const [status, setStatus] = useState("ACTIVE");

  // Content state for preview
  const [previewHtml, setPreviewHtml] = useState("");
  const contentHtmlRef = useRef<string>("");

  // Preview options
  const [previewTab, setPreviewTab] = useState<"split" | "editor" | "preview">("split");
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string>("SAMPLE");
  const [placeholderSearch, setPlaceholderSearch] = useState("");
  const [selectedPlaceholderCategory, setSelectedPlaceholderCategory] = useState<string>("ALL");

  const editorRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/hrms/templates?status=ALL");
      if (!res.ok) throw new Error("Failed to fetch templates");
      const data = await res.json();
      setTemplates(data);
      if (!activeTemplate && data.length > 0) {
        loadTemplateIntoEditor(data[0]);
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to load templates");
    } finally {
      setLoading(false);
    }
  };

  const fetchReferenceData = async () => {
    try {
      const [lhRes, candRes] = await Promise.all([
        fetch("/api/hrms/letterheads"),
        fetch("/api/hrms/candidates"),
      ]);
      if (lhRes.ok) setLetterheads(await lhRes.json());
      if (candRes.ok) setCandidates(await candRes.json());
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchReferenceData();
    fetchTemplates();
  }, []);

  const loadTemplateIntoEditor = (t: Template) => {
    setActiveTemplate(t);
    setIsEditingNew(false);
    setTitle(t.name);
    setDescription(t.description || "");
    setCategory(t.category);
    setLetterheadId(t.letterheadId || "");
    setStatus(t.status);
    setHasUnsavedChanges(false);

    contentHtmlRef.current = t.contentHtml;
    setPreviewHtml(t.contentHtml);

    if (editorRef.current) {
      editorRef.current.innerHTML = t.contentHtml;
    }
  };

  const handleCreateNew = () => {
    setActiveTemplate(null);
    setIsEditingNew(true);
    setTitle("New Offer Letter Template");
    setDescription("");
    setCategory("STANDARD");
    setLetterheadId(letterheads[0]?.id || "");
    setStatus("ACTIVE");

    const defaultHtml = `
<p><strong>Date:</strong> {{offer_date}}</p>
<p>To,</p>
<p><strong>{{candidate_name}}</strong></p>
<p>{{candidate_email}} | {{candidate_phone}}</p>
<p>{{candidate_address}}</p>

<h2>SUBJECT: OFFER OF EMPLOYMENT — {{job_title}}</h2>

<p>Dear {{candidate_name}},</p>
<p>We are delighted to offer you the position of <strong>{{job_title}}</strong> in our <strong>{{department}}</strong> department at <strong>{{company_name}}</strong>.</p>

<h3>1. Appointment Terms</h3>
<ul>
  <li><strong>Designation:</strong> {{job_title}}</li>
  <li><strong>Reporting Manager:</strong> {{reporting_manager}}</li>
  <li><strong>Employment Type:</strong> {{employment_type}}</li>
  <li><strong>Joining Date:</strong> {{joining_date}}</li>
  <li><strong>Work Location:</strong> {{work_location}}</li>
  <li><strong>Probation:</strong> {{probation_period}}</li>
</ul>

<h3>2. Compensation Breakdown</h3>
<p>Your total annual Cost to Company (CTC) will be <strong>{{annual_salary}}</strong> (monthly gross of <strong>{{monthly_salary}}</strong>).</p>

{{salary_breakdown}}

<h3>3. Offer Validity & Acceptance</h3>
<p>This employment offer remains valid until <strong>{{offer_expiry_date}}</strong>. Please sign below to acknowledge acceptance.</p>

<table style="width: 100%; margin-top: 40px; border-collapse: collapse;">
  <tr>
    <td style="width: 50%; vertical-align: top;">
      <p style="font-size: 13px; font-weight: bold; margin: 0 0 45px 0;">For {{company_name}}</p>
      <div style="border-top: 1px solid #94a3b8; width: 180px; padding-top: 4px;">
        <p style="font-size: 12px; font-weight: 600; margin: 0;">{{authorized_signatory}}</p>
      </div>
    </td>
    <td style="width: 50%; vertical-align: top;">
      <p style="font-size: 13px; font-weight: bold; margin: 0 0 45px 0;">Candidate Acceptance</p>
      <div style="border-top: 1px solid #94a3b8; width: 180px; padding-top: 4px;">
        <p style="font-size: 12px; font-weight: 600; margin: 0;">{{candidate_name}}</p>
        <p style="font-size: 11px; color: #64748b; margin: 0;">Date: ________________</p>
      </div>
    </td>
  </tr>
</table>
    `.trim();

    contentHtmlRef.current = defaultHtml;
    setPreviewHtml(defaultHtml);
    setHasUnsavedChanges(true);

    if (editorRef.current) {
      editorRef.current.innerHTML = defaultHtml;
    }
  };

  // Crucial: Handle input WITHOUT resetting cursor position via dangerouslySetInnerHTML
  const handleEditorInput = () => {
    if (!editorRef.current) return;
    const html = editorRef.current.innerHTML;
    contentHtmlRef.current = html;
    setHasUnsavedChanges(true);

    // Debounce updating preview so typing is 100% fluid
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      setPreviewHtml(html);
    }, 250);
  };

  // Prevent toolbar button clicks from stealing focus/selection from the editor
  const handleToolbarMouseDown = (e: React.MouseEvent, command: string, value: string | undefined = undefined) => {
    e.preventDefault();
    document.execCommand(command, false, value);
    if (editorRef.current) {
      contentHtmlRef.current = editorRef.current.innerHTML;
      setPreviewHtml(editorRef.current.innerHTML);
      setHasUnsavedChanges(true);
    }
  };

  // Insert token at cursor position
  const insertPlaceholder = (token: string) => {
    if (!editorRef.current) return;
    editorRef.current.focus();

    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      range.deleteContents();
      const node = document.createTextNode(token);
      range.insertNode(node);
      range.setStartAfter(node);
      range.setEndAfter(node);
      selection.removeAllRanges();
      selection.addRange(range);
    } else {
      editorRef.current.innerHTML += token;
    }

    contentHtmlRef.current = editorRef.current.innerHTML;
    setPreviewHtml(editorRef.current.innerHTML);
    setHasUnsavedChanges(true);
    toast.success(`Inserted ${token}`);
  };

  const insertSignatureBlock = () => {
    const sigHtml = `
<table style="width: 100%; margin-top: 36px; border-collapse: collapse;">
  <tr>
    <td style="width: 50%; vertical-align: top;">
      <p style="font-size: 13px; font-weight: bold; margin: 0 0 40px 0;">For {{company_name}}</p>
      <div style="border-top: 1px solid #94a3b8; width: 180px; padding-top: 4px;">
        <p style="font-size: 12px; font-weight: 600; margin: 0;">{{authorized_signatory}}</p>
      </div>
    </td>
    <td style="width: 50%; vertical-align: top;">
      <p style="font-size: 13px; font-weight: bold; margin: 0 0 40px 0;">Candidate Signature</p>
      <div style="border-top: 1px solid #94a3b8; width: 180px; padding-top: 4px;">
        <p style="font-size: 12px; font-weight: 600; margin: 0;">{{candidate_name}}</p>
      </div>
    </td>
  </tr>
</table>`;
    if (editorRef.current) {
      editorRef.current.focus();
      document.execCommand("insertHTML", false, sigHtml);
      contentHtmlRef.current = editorRef.current.innerHTML;
      setPreviewHtml(editorRef.current.innerHTML);
      setHasUnsavedChanges(true);
    }
  };

  const handleRemoveBlock = (key: string) => {
    const currentHtml = editorRef.current?.innerHTML || contentHtmlRef.current;
    const block = TEMPLATE_BLOCKS.find((b) => b.key === key);
    if (!block) return;

    const newHtml = block.remove(currentHtml);
    if (editorRef.current) {
      editorRef.current.innerHTML = newHtml;
    }
    contentHtmlRef.current = newHtml;
    setPreviewHtml(newHtml);
    setHasUnsavedChanges(true);
    toast.success(`Removed "${block.name}" block from template`);
  };

  const handleInsertBlock = (key: string) => {
    const currentHtml = editorRef.current?.innerHTML || contentHtmlRef.current;
    const block = TEMPLATE_BLOCKS.find((b) => b.key === key);
    if (!block) return;

    let newHtml = currentHtml;
    if (editorRef.current) {
      editorRef.current.focus();
      document.execCommand("insertHTML", false, `\n${block.defaultHtml}\n`);
      newHtml = editorRef.current.innerHTML;
    } else {
      newHtml = currentHtml + `\n${block.defaultHtml}\n`;
    }
    contentHtmlRef.current = newHtml;
    setPreviewHtml(newHtml);
    setHasUnsavedChanges(true);
    toast.success(`Inserted "${block.name}" block into template`);
  };

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error("Template name is required");
      return;
    }

    const currentContent = editorRef.current?.innerHTML || contentHtmlRef.current;

    try {
      if (activeTemplate && !isEditingNew) {
        const res = await fetch(`/api/hrms/templates/${activeTemplate.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: title.trim(),
            description,
            category,
            letterheadId: letterheadId || null,
            contentHtml: currentContent,
            status,
          }),
        });

        if (!res.ok) throw new Error("Failed to update template");
        const updated = await res.json();
        setActiveTemplate(updated);
        setHasUnsavedChanges(false);
        toast.success(`Template saved (v${updated.version})`);
      } else {
        const res = await fetch("/api/hrms/templates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: title.trim(),
            description,
            category,
            letterheadId: letterheadId || null,
            contentHtml: currentContent,
            status,
          }),
        });

        if (!res.ok) throw new Error("Failed to create template");
        const created = await res.json();
        setActiveTemplate(created);
        setIsEditingNew(false);
        setHasUnsavedChanges(false);
        toast.success("Template created successfully");
      }
      fetchTemplates();
    } catch (err: any) {
      toast.error(err.message || "Failed to save template");
    }
  };

  const handleDuplicate = async () => {
    if (!activeTemplate) return;
    try {
      const res = await fetch(`/api/hrms/templates/${activeTemplate.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "DUPLICATE" }),
      });
      if (!res.ok) throw new Error("Failed to duplicate template");
      toast.success("Template duplicated as draft!");
      fetchTemplates();
    } catch (e: any) {
      toast.error(e.message || "Failed to duplicate");
    }
  };

  const handleToggleArchive = async () => {
    if (!activeTemplate) return;
    const newStatus = activeTemplate.status === "ARCHIVED" ? "ACTIVE" : "ARCHIVED";
    try {
      const res = await fetch(`/api/hrms/templates/${activeTemplate.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error("Failed to change status");
      toast.success(`Template marked as ${newStatus}`);
      fetchTemplates();
    } catch (e: any) {
      toast.error(e.message || "Failed to update status");
    }
  };

  // Resolve preview data
  const selectedCandidate =
    selectedCandidateId !== "SAMPLE"
      ? candidates.find((c) => c.id === selectedCandidateId)
      : null;

  const selectedLetterhead =
    letterheads.find((lh) => lh.id === letterheadId) || letterheads[0];

  const resolvedPreview = resolvePlaceholders(
    previewHtml || contentHtmlRef.current,
    {
      candidate: selectedCandidate
        ? {
            name: selectedCandidate.name,
            email: selectedCandidate.email,
            phone: selectedCandidate.phone,
            address: selectedCandidate.address,
          }
        : undefined,
      job: selectedCandidate?.applications?.[0]?.jobOpening
        ? {
            title: selectedCandidate.applications[0].jobOpening.title,
            department: selectedCandidate.applications[0].jobOpening.department,
          }
        : undefined,
      letterhead: selectedLetterhead
        ? {
            companyName: selectedLetterhead.companyName,
            address: selectedLetterhead.address,
            email: selectedLetterhead.email,
            logoUrl: selectedLetterhead.logoUrl,
          }
        : undefined,
    },
    selectedCandidateId === "SAMPLE"
  );

  const categories = ["ALL", "Candidate", "Employment", "Compensation", "Company", "Document"];

  const filteredPlaceholders = PLACEHOLDERS.filter((p) => {
    const matchesSearch =
      p.label.toLowerCase().includes(placeholderSearch.toLowerCase()) ||
      p.token.toLowerCase().includes(placeholderSearch.toLowerCase());
    const matchesCategory =
      selectedPlaceholderCategory === "ALL" || p.category === selectedPlaceholderCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-4">
      {/* Top Template Selector & Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-card/60 p-3 rounded-lg border border-border/60">
        <div className="flex flex-wrap items-center gap-2.5">
          <Select
            value={activeTemplate?.id || "NEW"}
            onValueChange={(val) => {
              if (val === "NEW") handleCreateNew();
              else {
                const found = templates.find((t) => t.id === val);
                if (found) loadTemplateIntoEditor(found);
              }
            }}
          >
            <SelectTrigger aria-label="Select template" className="h-8 text-xs w-[240px]">
              <SelectValue placeholder="Select template" />
            </SelectTrigger>
            <SelectContent>
              {templates.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name} (v{t.version}) {t.status === "ARCHIVED" ? "[Archived]" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button variant="outline" size="xs" onClick={handleCreateNew} className="gap-1 text-xs">
            <Plus className="size-3" />
            <span>New Template</span>
          </Button>

          {activeTemplate && (
            <>
              <Button
                variant="outline"
                size="xs"
                onClick={handleDuplicate}
                className="gap-1 text-xs"
                title="Duplicate this template"
              >
                <Copy className="size-3" />
                <span>Duplicate</span>
              </Button>
              <Button
                variant="outline"
                size="xs"
                onClick={handleToggleArchive}
                className="gap-1 text-xs text-muted-foreground"
              >
                <Archive className="size-3" />
                <span>{activeTemplate.status === "ARCHIVED" ? "Restore" : "Archive"}</span>
              </Button>
            </>
          )}
        </div>

        {/* View Layout Toggle & Save */}
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border border-border/60 p-0.5 bg-muted/30">
            <Button
              variant={previewTab === "editor" ? "secondary" : "ghost"}
              size="xs"
              onClick={() => setPreviewTab("editor")}
              className="text-xs h-7 px-2.5 font-medium"
            >
              Editor Only
            </Button>
            <Button
              variant={previewTab === "split" ? "secondary" : "ghost"}
              size="xs"
              onClick={() => setPreviewTab("split")}
              className="text-xs h-7 px-2.5 font-medium"
            >
              Split View
            </Button>
            <Button
              variant={previewTab === "preview" ? "secondary" : "ghost"}
              size="xs"
              onClick={() => setPreviewTab("preview")}
              className="text-xs h-7 px-2.5 font-medium"
            >
              A4 Preview
            </Button>
          </div>

          <Button size="sm" onClick={handleSave} className="gap-1.5 text-xs font-semibold">
            <Save className="size-3.5" />
            <span>Save Template</span>
          </Button>
        </div>
      </div>

      {/* Meta Bar: Name, Category, Letterhead */}
      <Card className="border-border/60 shadow-xs">
        <CardContent className="p-3.5">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="space-y-1 md:col-span-2">
              <Label className="text-xs">Template Name *</Label>
              <Input aria-label="Template Name"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  setHasUnsavedChanges(true);
                }}
                placeholder="Template Name"
                className="h-8 text-xs font-semibold"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Category</Label>
              <Select
                value={category}
                onValueChange={(v) => {
                  setCategory(v);
                  setHasUnsavedChanges(true);
                }}
              >
                <SelectTrigger aria-label="Category" className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="STANDARD">Standard Full-Time</SelectItem>
                  <SelectItem value="EXECUTIVE">Executive Leadership</SelectItem>
                  <SelectItem value="CONTRACTOR">Contractor / Consultant</SelectItem>
                  <SelectItem value="INTERNSHIP">Internship Offer</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Branded Letterhead</Label>
              <Select
                value={letterheadId}
                onValueChange={(v) => {
                  setLetterheadId(v);
                  setHasUnsavedChanges(true);
                }}
              >
                <SelectTrigger aria-label="Branded Letterhead" className="h-8 text-xs">
                  <SelectValue placeholder="Select letterhead" />
                </SelectTrigger>
                <SelectContent>
                  {letterheads.map((lh) => (
                    <SelectItem key={lh.id} value={lh.id}>
                      {lh.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Split Screen Area: Editor & Live A4 Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* LEFT COLUMN: Document Editor & Toolbar */}
        {(previewTab === "split" || previewTab === "editor") && (
          <div className={`${previewTab === "split" ? "lg:col-span-6" : "lg:col-span-12"} space-y-3`}>
            {/* Rich Text Toolbar */}
            <Card className="border-border/60 shadow-xs">
              <CardContent className="p-2 space-y-2">
                <div className="flex flex-wrap items-center gap-1 border-b border-border/40 pb-1.5">
                  <Button aria-label="Bold"
                    variant="ghost"
                    size="icon-xs"
                    onMouseDown={(e) => handleToolbarMouseDown(e, "bold")}
                    title="Bold"
                  >
                    <Bold className="size-3.5" />
                  </Button>
                  <Button aria-label="Italic"
                    variant="ghost"
                    size="icon-xs"
                    onMouseDown={(e) => handleToolbarMouseDown(e, "italic")}
                    title="Italic"
                  >
                    <Italic className="size-3.5" />
                  </Button>
                  <Button aria-label="Underline"
                    variant="ghost"
                    size="icon-xs"
                    onMouseDown={(e) => handleToolbarMouseDown(e, "underline")}
                    title="Underline"
                  >
                    <Underline className="size-3.5" />
                  </Button>

                  <span className="w-px h-4 bg-border/60 mx-1" />

                  <Button aria-label="Align Left"
                    variant="ghost"
                    size="icon-xs"
                    onMouseDown={(e) => handleToolbarMouseDown(e, "justifyLeft")}
                    title="Align Left"
                  >
                    <AlignLeft className="size-3.5" />
                  </Button>
                  <Button aria-label="Align Center"
                    variant="ghost"
                    size="icon-xs"
                    onMouseDown={(e) => handleToolbarMouseDown(e, "justifyCenter")}
                    title="Align Center"
                  >
                    <AlignCenter className="size-3.5" />
                  </Button>
                  <Button aria-label="Align Right"
                    variant="ghost"
                    size="icon-xs"
                    onMouseDown={(e) => handleToolbarMouseDown(e, "justifyRight")}
                    title="Align Right"
                  >
                    <AlignRight className="size-3.5" />
                  </Button>

                  <span className="w-px h-4 bg-border/60 mx-1" />

                  <Button aria-label="Bullet List"
                    variant="ghost"
                    size="icon-xs"
                    onMouseDown={(e) => handleToolbarMouseDown(e, "insertUnorderedList")}
                    title="Bullet List"
                  >
                    <List className="size-3.5" />
                  </Button>
                  <Button aria-label="Numbered List"
                    variant="ghost"
                    size="icon-xs"
                    onMouseDown={(e) => handleToolbarMouseDown(e, "insertOrderedList")}
                    title="Numbered List"
                  >
                    <ListOrdered className="size-3.5" />
                  </Button>

                  <span className="w-px h-4 bg-border/60 mx-1" />

                  <Button aria-label="Heading 2"
                    variant="ghost"
                    size="icon-xs"
                    onMouseDown={(e) => handleToolbarMouseDown(e, "formatBlock", "h2")}
                    title="Heading 2"
                  >
                    <Heading2 className="size-3.5" />
                  </Button>
                  <Button aria-label="Heading 3"
                    variant="ghost"
                    size="icon-xs"
                    onMouseDown={(e) => handleToolbarMouseDown(e, "formatBlock", "h3")}
                    title="Heading 3"
                  >
                    <Heading3 className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onMouseDown={(e) => handleToolbarMouseDown(e, "formatBlock", "p")}
                    title="Paragraph"
                  >
                    <span className="text-xs font-bold">P</span>
                  </Button>

                  <span className="w-px h-4 bg-border/60 mx-1" />

                  <Button aria-label="Undo"
                    variant="ghost"
                    size="icon-xs"
                    onMouseDown={(e) => handleToolbarMouseDown(e, "undo")}
                    title="Undo"
                  >
                    <Undo className="size-3.5" />
                  </Button>
                  <Button aria-label="Redo"
                    variant="ghost"
                    size="icon-xs"
                    onMouseDown={(e) => handleToolbarMouseDown(e, "redo")}
                    title="Redo"
                  >
                    <Redo className="size-3.5" />
                  </Button>
                </div>

                {/* Insertion Utilities: Placeholders Picker & Prebuilts */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
                  <div className="flex items-center gap-1.5">
                    {/* Categorized Searchable Dynamic Placeholders Picker */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="outline"
                          size="xs"
                          className="gap-1 text-xs text-primary font-semibold"
                        >
                          <Sparkles className="size-3 text-amber-500" />
                          <span>Insert Dynamic Placeholder</span>
                          <ChevronDown className="size-2.5 opacity-60" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-80 max-h-96 overflow-y-auto">
                        <div className="p-2 space-y-2">
                          <Input aria-label="Filter placeholders"
                            placeholder="Filter placeholders..."
                            value={placeholderSearch}
                            onChange={(e) => setPlaceholderSearch(e.target.value)}
                            className="h-7 text-xs"
                          />
                          <div className="flex flex-wrap gap-1">
                            {categories.map((cat) => (
                              <button
                                key={cat}
                                type="button"
                                onClick={() => setSelectedPlaceholderCategory(cat)}
                                className={`px-1.5 py-0.5 rounded text-xs font-medium transition-colors ${
                                  selectedPlaceholderCategory === cat
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                                }`}
                              >
                                {cat}
                              </button>
                            ))}
                          </div>
                        </div>
                        <DropdownMenuSeparator />
                        {filteredPlaceholders.map((p) => (
                          <DropdownMenuItem
                            key={p.token}
                            onClick={() => insertPlaceholder(p.token)}
                            className="flex flex-col items-start gap-0.5 cursor-pointer py-1.5"
                          >
                            <span className="text-xs font-mono font-bold text-primary">{p.token}</span>
                            <span className="text-xs text-muted-foreground">
                              {p.label} • <em className="text-foreground/70">{p.exampleValue}</em>
                            </span>
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>

                    <Button
                      variant="outline"
                      size="xs"
                      onClick={() => insertPlaceholder("{{salary_breakdown}}")}
                      className="gap-1 text-xs"
                      title="Insert Salary CTC breakdown table"
                    >
                      <Table className="size-3 text-teal-600" />
                      <span>Salary Table</span>
                    </Button>

                    <Button
                      variant="outline"
                      size="xs"
                      onClick={insertSignatureBlock}
                      className="gap-1 text-xs"
                      title="Insert Signature Blocks"
                    >
                      <FileText className="size-3" />
                      <span>Signature Block</span>
                    </Button>

                    <Button
                      variant="outline"
                      size="xs"
                      onClick={() => setIsBlockModalOpen(true)}
                      className="gap-1.5 text-xs text-primary font-semibold border-primary/30 hover:bg-primary/5"
                      title="Manage and remove modular clauses and blocks from template"
                    >
                      <Layers className="size-3 text-primary" />
                      <span>Manage / Remove Blocks</span>
                    </Button>
                  </div>

                  {hasUnsavedChanges && (
                    <Badge variant="warning" size="sm" className="gap-1">
                      Unsaved edits
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Document Editor Canvas (UNCONTROLLED DOM with innerHTML initialization) */}
            <Card className="border-border/60 shadow-xs bg-card">
              <CardContent className="p-4 sm:p-6">
                <div
                  ref={editorRef}
                  contentEditable
                  onInput={handleEditorInput}
                  className="min-h-[550px] outline-hidden prose prose-sm max-w-none text-foreground font-sans leading-relaxed focus:ring-0"
                  style={{
                    fontFamily: selectedLetterhead?.fontFamily || "'Inter', sans-serif",
                  }}
                />
              </CardContent>
            </Card>
          </div>
        )}

        {/* RIGHT COLUMN: Realistic Live A4 Document Preview */}
        {(previewTab === "split" || previewTab === "preview") && (
          <div className={`${previewTab === "split" ? "lg:col-span-6" : "lg:col-span-12"} space-y-3`}>
            {/* Preview Toolbar: Candidate Data Selector, Zoom, Download Sample */}
            <Card className="border-border/60 shadow-xs">
              <CardContent className="p-2.5 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-muted-foreground">Preview Data:</span>
                  <Select
                    value={selectedCandidateId}
                    onValueChange={setSelectedCandidateId}
                  >
                    <SelectTrigger aria-label="Preview Candidate" className="h-7 text-xs w-[200px]">
                      <SelectValue placeholder="Preview Candidate" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SAMPLE">Sample Candidate (Aarav Sharma)</SelectItem>
                      {candidates.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name} ({c.currentTitle || "Candidate"})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-2">
                  {/* Zoom controls */}
                  <div className="flex items-center rounded-md border border-border/60 p-0.5 bg-muted/20">
                    <Button aria-label="Zoom Out"
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => setZoomLevel((z) => Math.max(60, z - 10))}
                      title="Zoom Out"
                    >
                      <ZoomOut className="size-3" />
                    </Button>
                    <span className="text-xs font-mono px-1 font-semibold">{zoomLevel}%</span>
                    <Button aria-label="Zoom In"
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => setZoomLevel((z) => Math.min(130, z + 10))}
                      title="Zoom In"
                    >
                      <ZoomIn className="size-3" />
                    </Button>
                  </div>

                  {resolvedPreview.unresolvedTokens.length > 0 ? (
                    <Badge variant="destructive" size="sm" className="gap-1">
                      <AlertCircle className="size-3" />
                      <span>{resolvedPreview.unresolvedTokens.length} Missing</span>
                    </Badge>
                  ) : (
                    <Badge variant="success" size="sm" className="gap-1">
                      <CheckCircle className="size-3" />
                      <span>Resolved</span>
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* A4 Realistic White Sheet Canvas with zoom scaling */}
            <div className="bg-slate-200 dark:bg-slate-900/80 p-4 rounded-xl border border-border/60 flex justify-center overflow-x-auto min-h-[650px]">
              <div
                style={{
                  transform: `scale(${zoomLevel / 100})`,
                  transformOrigin: "top center",
                  transition: "transform 0.15s ease-out",
                  fontFamily: selectedLetterhead?.fontFamily || "'Inter', sans-serif",
                }}
                className="bg-white text-slate-900 shadow-2xl rounded-sm p-8 sm:p-10 w-full max-w-[620px] min-h-[840px] flex flex-col justify-between"
              >
                {/* Branded Letterhead Header */}
                <div>
                  {selectedLetterhead?.headerHtml ? (
                    <div
                      dangerouslySetInnerHTML={{ __html: selectedLetterhead.headerHtml }}
                      className="mb-6"
                    />
                  ) : (
                    <div className="border-b-2 border-blue-700 pb-3 mb-6 flex items-start justify-between">
                      <div>
                        <h2 className="text-lg font-black tracking-tight text-blue-700">
                          {selectedLetterhead?.companyName || "ITS ME DEZINO"}
                        </h2>
                        <p className="text-xs text-slate-500 font-semibold tracking-wide">
                          DIGITAL TECHNOLOGIES & CREATIVE SOLUTIONS
                        </p>
                      </div>
                      <div className="text-right text-xs text-slate-500 leading-tight">
                        <div>Level 4, Dezino Tower, Cyber City</div>
                        <div>Gurugram, Haryana 122002</div>
                        <div>careers@itsmedezino.com</div>
                      </div>
                    </div>
                  )}

                  {/* Rendered Document Body with resolved tokens */}
                  <div
                    className="prose prose-sm max-w-none text-slate-800 leading-relaxed text-[13px]"
                    dangerouslySetInnerHTML={{ __html: resolvedPreview.renderedHtml }}
                  />
                </div>

                {/* Branded Letterhead Footer */}
                {selectedLetterhead?.footerHtml ? (
                  <div
                    dangerouslySetInnerHTML={{ __html: selectedLetterhead.footerHtml }}
                    className="mt-8"
                  />
                ) : (
                  <div className="mt-8 border-t border-slate-200 pt-3 flex justify-between text-xs text-slate-400">
                    <span>Confidential — Employment Document</span>
                    <span>www.itsmedezino.com</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ================= MANAGE / REMOVE BLOCKS MODAL ================= */}
      <Dialog open={isBlockModalOpen} onOpenChange={setIsBlockModalOpen}>
        <DialogContent className="w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Layers className="size-4 text-primary" />
              <span>Manage & Remove Template Blocks</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Inspect, add, or cleanly remove modular offer letter clauses, salary tables, and execution blocks from the current template.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            {TEMPLATE_BLOCKS.map((block) => {
              const currentContent = editorRef.current?.innerHTML || contentHtmlRef.current || previewHtml;
              const isPresent = block.isMatch(currentContent);
              return (
                <div
                  key={block.key}
                  className={`p-3 rounded-xl border transition-all flex items-start justify-between gap-3 ${
                    isPresent
                      ? "bg-card border-border shadow-2xs"
                      : "bg-muted/20 border-dashed border-border/80 opacity-70"
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-xs text-foreground">{block.name}</span>
                      <Badge
                        variant={isPresent ? "default" : "outline"}
                        className={`text-xs py-0 px-1.5 ${isPresent ? "bg-emerald-600 text-white" : ""}`}
                      >
                        {isPresent ? "Included in Template" : "Not Included"}
                      </Badge>
                      <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                        {block.category}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">{block.description}</p>
                  </div>

                  <div className="shrink-0 pt-0.5">
                    {isPresent ? (
                      <Button
                        variant="destructive"
                        size="xs"
                        onClick={() => handleRemoveBlock(block.key)}
                        className="gap-1 text-xs"
                      >
                        <Trash2 className="size-3" />
                        <span>Remove Block</span>
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="xs"
                        onClick={() => handleInsertBlock(block.key)}
                        className="gap-1 text-xs text-primary font-medium"
                      >
                        <Plus className="size-3" />
                        <span>Insert Block</span>
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <DialogFooter>
            <Button size="sm" onClick={() => setIsBlockModalOpen(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
