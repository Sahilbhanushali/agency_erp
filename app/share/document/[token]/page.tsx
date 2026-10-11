import type { Metadata } from "next"
import { AlertCircle, Clock } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { Card, CardContent } from "@/components/ui/card"
import DocumentView from "@/components/finance/document-view"
import { formatMoney, paymentSummary, quotationDetailSelect, invoiceDetailSelect, toNumber } from "@/lib/finance"
import PrintButton from "@/components/finance/print-button"

/**
 * The public client view of a quotation or invoice — no login, authenticated purely by
 * the share token. `middleware.ts` lets /share/** through on any host.
 *
 * A share token is a credential: it is looked up, checked for expiry, and only the
 * fields this page renders are selected. One token space serves both document types,
 * so the client link does not reveal which kind of record it points at.
 */
interface PageProps {
  params: Promise<{ token: string }>
}

async function findDocument(token: string) {
  if (!token || token.length < 32) return null

  const [quotation, invoice] = await Promise.all([
    prisma.quotation.findUnique({ where: { shareToken: token }, select: quotationDetailSelect }),
    prisma.invoice.findUnique({ where: { shareToken: token }, select: invoiceDetailSelect }),
  ])

  if (quotation) return { kind: "Quotation" as const, document: quotation }
  if (invoice) return { kind: "Invoice" as const, document: invoice }
  return null
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { token } = await params
  const found = await findDocument(token)
  if (!found) return { title: "Document not available" }
  return {
    title: `${found.kind} ${found.document.number}`,
    description: found.document.title,
    // A tokenised page must never reach a search index.
    robots: { index: false, follow: false },
  }
}

/**
 * Rendered at HTTP 200 on purpose, for a bogus, revoked or expired token alike: a 404
 * for "no such token" and a 200 for "expired" would let someone probing tokens tell the
 * two apart from the status code alone. The client sees one explanatory screen either way.
 */
function Unavailable({ title, message }: { title: string; message: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 p-6">
      <Card className="max-w-md">
        <CardContent className="p-10 text-center">
          <AlertCircle className="mx-auto h-10 w-10 text-muted-foreground/50" />
          <h1 className="mt-4 text-lg font-medium">{title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{message}</p>
        </CardContent>
      </Card>
    </main>
  )
}

export default async function SharedDocumentPage({ params }: PageProps) {
  const { token } = await params
  const found = await findDocument(token)

  if (!found) {
    return (
      <Unavailable
        title="This link is not valid"
        message="The document may have been removed, or the link revoked. Ask your contact at the agency for a new one."
      />
    )
  }

  const { kind, document } = found

  if (document.shareExpiresAt && new Date(document.shareExpiresAt) < new Date()) {
    return (
      <Unavailable
        title="This link has expired"
        message="Ask your contact at the agency to send a fresh link."
      />
    )
  }

  // Payment position is shown only for invoices, and only once something has been paid.
  const summary =
    kind === "Invoice" && "payments" in document
      ? paymentSummary(document.totalAmount, document.payments, document.status)
      : null

  return (
    <main className="min-h-screen bg-muted/30 py-6 print:bg-white print:py-0">
      <div className="mx-auto max-w-[860px] px-4 print:px-0">
        <div className="mb-4 flex items-center justify-between gap-4 print:hidden">
          <p className="text-sm text-muted-foreground">
            {kind} <span className="font-mono">{document.number}</span>
          </p>
          <PrintButton />
        </div>

        <DocumentView document={document} kind={kind} />

        {summary && summary.paid > 0 && (
          <Card className="mt-4 print:hidden">
            <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4 text-sm">
              <span className="inline-flex items-center gap-2 text-muted-foreground">
                <Clock className="h-4 w-4" aria-hidden="true" />
                Payments received
              </span>
              <span className="tabular-nums">
                {formatMoney(summary.paid, document.currency)} of{" "}
                {formatMoney(toNumber(document.totalAmount), document.currency)}
                {summary.balance > 0 && (
                  <strong className="ml-2">
                    {formatMoney(summary.balance, document.currency)} due
                  </strong>
                )}
              </span>
            </CardContent>
          </Card>
        )}

        {document.shareExpiresAt && (
          <p className="mt-4 text-center text-xs text-muted-foreground print:hidden">
            This link expires on{" "}
            {new Date(document.shareExpiresAt).toLocaleDateString("en-IN", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
            .
          </p>
        )}
      </div>
    </main>
  )
}
