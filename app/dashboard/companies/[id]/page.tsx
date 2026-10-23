"use client";

import { useParams, useRouter } from "next/navigation";
import useSWR from "swr";
import Link from "next/link";
import { format } from "date-fns";
import {
  ArrowLeft,
  Building2,
  Edit,
  Mail,
  Phone,
  Globe,
  MapPin,
  CreditCard,
  FileText,
  Receipt,
  FileCheck2,
  ExternalLink,
  Copy,
  Check,
  ShieldCheck,
  Landmark,
} from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useBreadcrumbTitle } from "@/lib/route-labels";
import { getMediaUrl } from "@/lib/utils";
import type { Company } from "@/types/finance";

interface CompanyDetails extends Company {
  quotations?: Array<{
    id: string;
    number: string;
    title: string;
    status: string;
    currency: string;
    totalAmount: number | string;
    createdAt: string;
    client?: { id: string; name: string };
  }>;
  invoices?: Array<{
    id: string;
    number: string;
    title: string;
    status: string;
    currency: string;
    totalAmount: number | string;
    createdAt: string;
    client?: { id: string; name: string };
  }>;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function CompanyDetailPage() {
  const params = useParams();
  const router = useRouter();
  const companyId = params.id as string;
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const { data, isLoading, error } = useSWR<{ company: CompanyDetails }>(
    companyId ? `/api/companies/${companyId}` : null,
    fetcher
  );

  const company = data?.company;

  useBreadcrumbTitle(companyId, company?.name || "Company Overview");

  const copyToClipboard = (text: string, label: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(label);
    toast.success(`${label} copied to clipboard`);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="space-y-2">
          <Skeleton className="h-8 w-56 rounded-lg" />
          <Skeleton className="h-4 w-72 rounded-md" />
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <Skeleton className="h-96 rounded-xl lg:col-span-7" />
          <Skeleton className="h-96 rounded-xl lg:col-span-5" />
        </div>
      </div>
    );
  }

  if (error || !company) {
    return (
      <div className="py-12">
        <EmptyState
          icon={Building2}
          title="Company Not Found"
          description="The billing entity could not be located or has been deactivated."
          actionLabel="Back to Companies"
          onAction={() => router.push("/dashboard/companies")}
        />
      </div>
    );
  }

  const logoUrl = getMediaUrl(company.logo);
  const letterheadUrl = getMediaUrl(company.letterhead);
  const signatureUrl = getMediaUrl(company.signature);

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      {/* Top Header */}
      <PageHeader
        title={company.name}
        description={
          company.legalName
            ? `${company.legalName} • Agency Billing Entity`
            : "Agency Billing Entity & Invoice Issuer"
        }
        badge={
          <div className="flex items-center gap-2">
            <Badge variant={company.isActive ? "success" : "neutral"} dot className="text-xs">
              {company.isActive ? "Active Issuer" : "Inactive"}
            </Badge>
            <Badge variant="outline" className="font-mono text-[10px]">
              {company.currency || "INR"}
            </Badge>
          </div>
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" asChild className="gap-1.5">
            <Link href="/dashboard/companies">
              <ArrowLeft className="size-3.5" />
              Companies
            </Link>
          </Button>
          <Button size="sm" asChild className="gap-1.5">
            <Link href={`/dashboard/companies/${company.id}/edit`}>
              <Edit className="size-3.5" />
              Edit Company
            </Link>
          </Button>
        </div>
      </PageHeader>

      {/* KPI Metric Chips */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-border/70 bg-card p-4 shadow-2xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[11px] font-medium uppercase tracking-wider">Quotations</span>
            <FileText className="size-4" />
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-foreground tabular-nums">
            {company._count?.quotations ?? 0}
          </p>
        </div>

        <div className="rounded-xl border border-border/70 bg-card p-4 shadow-2xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[11px] font-medium uppercase tracking-wider">Tax Invoices</span>
            <Receipt className="size-4" />
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-foreground tabular-nums">
            {company._count?.invoices ?? 0}
          </p>
        </div>

        <div className="rounded-xl border border-border/70 bg-card p-4 shadow-2xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[11px] font-medium uppercase tracking-wider">GSTIN Registered</span>
            <ShieldCheck className="size-4" />
          </div>
          <p className="mt-2 text-sm font-semibold tracking-tight text-foreground font-mono truncate">
            {company.gstNumber || "Unregistered"}
          </p>
        </div>

        <div className="rounded-xl border border-border/70 bg-card p-4 shadow-2xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[11px] font-medium uppercase tracking-wider">Bank Wire</span>
            <Landmark className="size-4" />
          </div>
          <p className="mt-2 text-sm font-semibold tracking-tight text-foreground truncate">
            {company.bankName || "No Bank Configured"}
          </p>
        </div>
      </div>

      {/* Main Grid: Details + Document Mockup */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
        {/* Left Column (7 cols): Data Cards */}
        <div className="space-y-6 lg:col-span-7">
          {/* Statutory Identifiers */}
          <Card className="shadow-2xs border-border/70">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="size-4 text-muted-foreground" />
                <CardTitle className="text-sm font-semibold">Statutory & Tax Details</CardTitle>
              </div>
              <CardDescription className="text-xs">
                Official registration details printed on domestic & international invoices.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium text-muted-foreground">GSTIN</span>
                  {company.gstNumber && (
                    <button
                      onClick={() => copyToClipboard(company.gstNumber!, "GSTIN")}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                      title="Copy GSTIN"
                    >
                      {copiedKey === "GSTIN" ? <Check className="size-3 text-emerald-600" /> : <Copy className="size-3" />}
                    </button>
                  )}
                </div>
                <p className="mt-1 font-mono text-xs font-semibold text-foreground">
                  {company.gstNumber || "—"}
                </p>
              </div>

              <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium text-muted-foreground">PAN Number</span>
                  {company.panNumber && (
                    <button
                      onClick={() => copyToClipboard(company.panNumber!, "PAN")}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                      title="Copy PAN"
                    >
                      {copiedKey === "PAN" ? <Check className="size-3 text-emerald-600" /> : <Copy className="size-3" />}
                    </button>
                  )}
                </div>
                <p className="mt-1 font-mono text-xs font-semibold text-foreground">
                  {company.panNumber || "—"}
                </p>
              </div>

              <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
                <span className="text-[11px] font-medium text-muted-foreground">HSN / SAC Code</span>
                <p className="mt-1 font-mono text-xs font-semibold text-foreground">
                  {company.hsnNumber || "—"}
                </p>
              </div>

              <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
                <span className="text-[11px] font-medium text-muted-foreground">Default Currency</span>
                <p className="mt-1 font-mono text-xs font-semibold text-foreground">
                  {company.currency || "INR"}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Payment & Banking */}
          <Card className="shadow-2xs border-border/70">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Landmark className="size-4 text-muted-foreground" />
                <CardTitle className="text-sm font-semibold">Bank Remittance Instructions</CardTitle>
              </div>
              <CardDescription className="text-xs">
                Beneficiary account details automatically printed on client invoices.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 pt-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <span className="text-[11px] font-medium text-muted-foreground">Bank Name</span>
                  <p className="text-xs font-semibold text-foreground mt-0.5">{company.bankName || "—"}</p>
                </div>
                <div>
                  <span className="text-[11px] font-medium text-muted-foreground">Account Holder</span>
                  <p className="text-xs font-semibold text-foreground mt-0.5">{company.bankAccountName || "—"}</p>
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-medium text-muted-foreground">Account Number</span>
                    {company.bankAccountNumber && (
                      <button
                        onClick={() => copyToClipboard(company.bankAccountNumber!, "Account No")}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        {copiedKey === "Account No" ? <Check className="size-3 text-emerald-600" /> : <Copy className="size-3" />}
                      </button>
                    )}
                  </div>
                  <p className="font-mono text-xs font-semibold text-foreground mt-0.5">
                    {company.bankAccountNumber || "—"}
                  </p>
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-medium text-muted-foreground">IFSC / SWIFT Code</span>
                    {company.bankIfsc && (
                      <button
                        onClick={() => copyToClipboard(company.bankIfsc!, "IFSC")}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        {copiedKey === "IFSC" ? <Check className="size-3 text-emerald-600" /> : <Copy className="size-3" />}
                      </button>
                    )}
                  </div>
                  <p className="font-mono text-xs font-semibold text-foreground mt-0.5">
                    {company.bankIfsc || "—"}
                  </p>
                </div>
                {company.bankBranch && (
                  <div className="sm:col-span-2">
                    <span className="text-[11px] font-medium text-muted-foreground">Branch Location</span>
                    <p className="text-xs text-foreground mt-0.5">{company.bankBranch}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Contact & Registered Office */}
          <Card className="shadow-2xs border-border/70">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <MapPin className="size-4 text-muted-foreground" />
                <CardTitle className="text-sm font-semibold">Registered Office & Contact</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-1">
              <div>
                <span className="text-[11px] font-medium text-muted-foreground">Physical Address</span>
                <p className="text-xs text-foreground mt-1 whitespace-pre-line leading-relaxed">
                  {[
                    company.addressLine1,
                    company.addressLine2,
                    [company.city, company.state, company.postalCode].filter(Boolean).join(" - "),
                    company.country,
                  ]
                    .filter(Boolean)
                    .join("\n") || "No registered address specified"}
                </p>
              </div>

              <div className="pt-2 border-t border-border/60 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="flex items-center gap-2">
                  <Mail className="size-3.5 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[11px] text-muted-foreground">Email</p>
                    <p className="text-xs font-medium text-foreground truncate">{company.email || "—"}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Phone className="size-3.5 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[11px] text-muted-foreground">Phone</p>
                    <p className="text-xs font-medium text-foreground truncate">{company.phone || "—"}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Globe className="size-3.5 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[11px] text-muted-foreground">Website</p>
                    {company.website ? (
                      <a
                        href={company.website.startsWith("http") ? company.website : `https://${company.website}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs font-medium text-primary hover:underline flex items-center gap-1 truncate"
                      >
                        {company.website.replace(/^https?:\/\//, "")}
                        <ExternalLink className="size-2.5 shrink-0" />
                      </a>
                    ) : (
                      <p className="text-xs font-medium text-foreground">—</p>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column (5 cols): Document Brand Preview */}
        <div className="space-y-6 lg:col-span-5">
          <Card className="shadow-2xs border-border/70 overflow-hidden">
            <CardHeader className="pb-3 bg-muted/20 border-b border-border/60">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileCheck2 className="size-4 text-muted-foreground" />
                  <CardTitle className="text-sm font-semibold">Document Template Preview</CardTitle>
                </div>
                <Badge variant="outline" className="text-[10px] font-mono">
                  Live Header Layout
                </Badge>
              </div>
              <CardDescription className="text-xs">
                Rendered letterhead header generated on Quotations and Invoices.
              </CardDescription>
            </CardHeader>

            <CardContent className="p-4 space-y-4">
              {/* Document Mockup Canvas */}
              <div className="rounded-lg border border-border/80 bg-background shadow-xs overflow-hidden text-[11px]">
                {/* Letterhead Top Banner */}
                {letterheadUrl ? (
                  <div className="w-full bg-muted/40 border-b border-border/60 overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={letterheadUrl}
                      alt="Company Letterhead Header"
                      className="w-full max-h-24 object-contain mx-auto"
                    />
                  </div>
                ) : (
                  <div className="h-1.5 w-full bg-primary" />
                )}

                {/* Header Body */}
                <div className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      {logoUrl ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={logoUrl}
                          alt="Logo"
                          className="size-11 object-contain rounded-md border border-border/60 bg-muted/10 p-1"
                        />
                      ) : (
                        <div className="size-11 rounded-md bg-muted flex items-center justify-center font-bold text-muted-foreground text-sm">
                          {company.name.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <h4 className="font-bold text-foreground text-xs">{company.name}</h4>
                        {company.legalName && (
                          <p className="text-[10px] text-muted-foreground">{company.legalName}</p>
                        )}
                        <p className="text-[9px] text-muted-foreground font-mono mt-0.5">
                          GST: {company.gstNumber || "PENDING"} • PAN: {company.panNumber || "PENDING"}
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="font-bold text-xs uppercase tracking-wider text-muted-foreground">
                        TAX INVOICE
                      </span>
                      <p className="font-mono text-[10px] text-muted-foreground">#INV-SAMPLE</p>
                    </div>
                  </div>

                  {/* Wire Instructions Snippet */}
                  <div className="rounded border border-border/50 bg-muted/10 p-2 text-[10px] space-y-0.5 text-muted-foreground">
                    <div className="flex justify-between font-mono">
                      <span>Bank:</span>
                      <span className="font-semibold text-foreground">{company.bankName || <span className="font-normal italic text-muted-foreground">Not set</span>}</span>
                    </div>
                    <div className="flex justify-between font-mono">
                      <span>A/C:</span>
                      <span className="font-semibold text-foreground">
                        {company.bankAccountNumber || <span className="font-normal italic text-muted-foreground">Not set</span>}
                      </span>
                    </div>
                    <div className="flex justify-between font-mono">
                      <span>IFSC:</span>
                      <span className="font-semibold text-foreground">{company.bankIfsc || <span className="font-normal italic text-muted-foreground">Not set</span>}</span>
                    </div>
                  </div>

                  {/* Signature Section */}
                  <div className="pt-2 border-t border-border/50 flex items-center justify-between">
                    <span className="text-[9px] text-muted-foreground italic">Authorized Signatory</span>
                    {signatureUrl ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={signatureUrl}
                        alt="Signature"
                        className="h-8 max-w-[110px] object-contain"
                      />
                    ) : (
                      <span className="text-[9px] text-muted-foreground font-mono border-b border-dashed border-border px-4 py-0.5">
                        [Signature Stamp]
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Asset Status Checks */}
              <div className="space-y-2 pt-2 text-xs">
                <div className="flex items-center justify-between py-1.5 border-b border-border/60">
                  <span className="text-muted-foreground">Document Letterhead</span>
                  <Badge variant={letterheadUrl ? "success" : "neutral"} className="text-[10px]">
                    {letterheadUrl ? "Uploaded" : "Default Strip"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between py-1.5 border-b border-border/60">
                  <span className="text-muted-foreground">Company Logo</span>
                  <Badge variant={logoUrl ? "success" : "neutral"} className="text-[10px]">
                    {logoUrl ? "Uploaded" : "Initials Badge"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between py-1.5">
                  <span className="text-muted-foreground">Authorized Signature</span>
                  <Badge variant={signatureUrl ? "success" : "neutral"} className="text-[10px]">
                    {signatureUrl ? "Uploaded" : "Missing"}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Tabs: Quotations & Invoices issued under this company */}
      <Card className="shadow-2xs border-border/70">
        <Tabs defaultValue="invoices" className="w-full">
          <CardHeader className="pb-2 border-b border-border/60">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <CardTitle className="text-base font-semibold">Issued Documents</CardTitle>
                <CardDescription className="text-xs">
                  Financial records and estimates processed under this legal entity.
                </CardDescription>
              </div>
              <TabsList className="h-8">
                <TabsTrigger value="invoices" className="text-xs">
                  Invoices ({company.invoices?.length ?? company._count?.invoices ?? 0})
                </TabsTrigger>
                <TabsTrigger value="quotations" className="text-xs">
                  Quotations ({company.quotations?.length ?? company._count?.quotations ?? 0})
                </TabsTrigger>
              </TabsList>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {/* Invoices Tab */}
            <TabsContent value="invoices" className="m-0">
              {company.invoices && company.invoices.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice #</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">Issued Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {company.invoices.map((inv) => (
                      <TableRow key={inv.id}>
                        <TableCell className="font-mono text-xs font-semibold">
                          {inv.number}
                        </TableCell>
                        <TableCell className="text-xs text-foreground font-medium">
                          {inv.title}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {inv.client?.name || "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px]">
                            {inv.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs font-semibold">
                          ₹{Number(inv.totalAmount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground">
                          {format(new Date(inv.createdAt), "dd MMM yyyy")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="py-10 text-center">
                  <p className="text-xs text-muted-foreground">
                    No tax invoices have been generated by this company yet.
                  </p>
                </div>
              )}
            </TabsContent>

            {/* Quotations Tab */}
            <TabsContent value="quotations" className="m-0">
              {company.quotations && company.quotations.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Quotation #</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">Issued Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {company.quotations.map((qt) => (
                      <TableRow key={qt.id}>
                        <TableCell className="font-mono text-xs font-semibold">
                          <Link
                            href={`/dashboard/quotations/${qt.id}`}
                            className="text-foreground hover:text-primary hover:underline"
                          >
                            {qt.number}
                          </Link>
                        </TableCell>
                        <TableCell className="text-xs text-foreground font-medium">
                          {qt.title}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {qt.client?.name || "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px]">
                            {qt.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs font-semibold">
                          ₹{Number(qt.totalAmount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground">
                          {format(new Date(qt.createdAt), "dd MMM yyyy")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="py-10 text-center">
                  <p className="text-xs text-muted-foreground">
                    No quotations have been issued by this company yet.
                  </p>
                </div>
              )}
            </TabsContent>
          </CardContent>
        </Tabs>
      </Card>
    </div>
  );
}
