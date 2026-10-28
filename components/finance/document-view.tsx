import { computeTotals, formatMoney, toNumber } from "@/lib/finance"
import type { Company, TaxType } from "@/types/finance"

/**
 * The printed quotation or invoice document.
 * Rendered identically for staff and for the client's public link.
 * Supports letterhead template banner and authorised signature.
 */
export interface FinanceDocument {
  number: string
  title: string
  currency: string
  discountPercent: unknown
  taxType: TaxType
  taxPercent: unknown
  validUntil?: Date | string | null
  issueDate?: Date | string | null
  dueDate?: Date | string | null
  terms?: string | null
  notes?: string | null
  createdAt: Date | string
  company: Company | Record<string, unknown>
  client: { name: string; email?: string | null; phone?: string | null; company?: string | null }
  /** The client company billed; its name, address and tax IDs replace the client's. */
  clientCompany?: {
    name: string
    gstin?: string | null
    panNumber?: string | null
    address?: string | null
    city?: string | null
    state?: string | null
    postalCode?: string | null
    country?: string | null
  } | null
  project?: { name: string } | null
  /** Decimals arrive straight from Prisma or as JSON strings — coerced below. */
  lineItems: {
    id?: string
    description: string
    quantity: unknown
    unit?: string | null
    unitPrice: unknown
  }[]
}

const formatDate = (value: Date | string | null | undefined) =>
  value
    ? new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
    : "—"

/** Address lines, skipping whatever the company has not filled in. */
const addressLines = (company: Record<string, unknown>) =>
  [
    company.addressLine1,
    company.addressLine2,
    [company.city, company.state].filter(Boolean).join(", "),
    [company.postalCode, company.country].filter(Boolean).join(" "),
  ].filter((line) => typeof line === "string" && line.trim() !== "") as string[]

export default function DocumentView({
  document,
  kind,
}: {
  document: FinanceDocument
  kind: "Quotation" | "Invoice"
}) {
  const company = document.company as Record<string, unknown>
  const currency = document.currency || "INR"
  const lines = document.lineItems.map((line) => ({
    ...line,
    quantity: toNumber(line.quantity),
    unitPrice: toNumber(line.unitPrice),
  }))

  const totals = computeTotals({
    lineItems: lines,
    discountPercent: toNumber(document.discountPercent),
    taxPercent: toNumber(document.taxPercent),
    taxType: document.taxType,
  })
  const half = toNumber(document.taxPercent) / 2
  const money = (amount: number) => formatMoney(amount, currency)
  const billed = document.clientCompany ?? null
  const billedName = billed?.name || document.client.company || document.client.name

  return (
    <article className="mx-auto w-full max-w-[820px] bg-white p-6 text-[13px] leading-relaxed text-neutral-900 shadow-sm sm:p-10 print:max-w-none print:p-0 print:shadow-none">
      {/* Letterhead Header Banner if configured */}
      {typeof company.letterhead === "string" && company.letterhead ? (
        <div className="mb-6 -mx-6 sm:-mx-10 -mt-6 sm:-mt-10 overflow-hidden border-b border-neutral-200 print:mb-4 print:mx-0 print:mt-0">
          {/* eslint-disable-next-line @next/next/no-img-element -- print fidelity: no Next/Image proxy */}
          <img
            src={company.letterhead}
            alt={`${company.name} letterhead`}
            className="w-full h-auto max-h-44 object-contain mx-auto"
          />
        </div>
      ) : null}

      {/* Issuer & Document Meta */}
      <header className="flex flex-wrap items-start justify-between gap-6 border-b border-neutral-200 pb-6">
        <div className="min-w-0">
          {/* Company Logo (displayed if no letterhead, or as header branding) */}
          {(!company.letterhead && typeof company.logo === "string" && company.logo) ? (
            // eslint-disable-next-line @next/next/no-img-element -- print fidelity: no Next/Image proxy
            <img
              src={company.logo}
              alt={`${company.name} logo`}
              className="mb-3 h-12 w-auto object-contain"
            />
          ) : null}
          <h2 className="text-lg font-semibold">{String(company.legalName || company.name || "")}</h2>
          <div className="mt-1 space-y-0.5 text-neutral-600">
            {addressLines(company).map((line) => (
              <p key={line}>{line}</p>
            ))}
            {typeof company.email === "string" && company.email && <p>{company.email}</p>}
            {typeof company.phone === "string" && company.phone && <p>{company.phone}</p>}
          </div>
          <div className="mt-2 space-y-0.5 text-xs text-neutral-500">
            {typeof company.gstNumber === "string" && company.gstNumber && (
              <p>GSTIN: {company.gstNumber}</p>
            )}
            {typeof company.panNumber === "string" && company.panNumber && (
              <p>PAN: {company.panNumber}</p>
            )}
          </div>
        </div>

        <div className="text-right">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">{kind}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{document.number}</p>
          <dl className="mt-3 space-y-1 text-xs">
            <div className="flex justify-end gap-2">
              <dt className="text-neutral-500">Date</dt>
              <dd className="tabular-nums">{formatDate(document.issueDate ?? document.createdAt)}</dd>
            </div>
            {document.validUntil && (
              <div className="flex justify-end gap-2">
                <dt className="text-neutral-500">Valid until</dt>
                <dd className="tabular-nums">{formatDate(document.validUntil)}</dd>
              </div>
            )}
            {document.dueDate && (
              <div className="flex justify-end gap-2">
                <dt className="text-neutral-500">Due</dt>
                <dd className="tabular-nums">{formatDate(document.dueDate)}</dd>
              </div>
            )}
          </dl>
        </div>
      </header>

      {/* Recipient */}
      <section className="flex flex-wrap items-start justify-between gap-6 py-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
            Billed to
          </p>
          <p className="mt-2 font-medium">{billedName}</p>
          {billedName !== document.client.name && <p className="text-neutral-600">{document.client.name}</p>}
          {billed &&
            [billed.address, [billed.city, billed.state].filter(Boolean).join(", "), [billed.postalCode, billed.country].filter(Boolean).join(" ")]
              .filter((line) => line && line.trim())
              .map((line) => (
                <p key={line} className="text-neutral-600">
                  {line}
                </p>
              ))}
          {document.client.email && <p className="text-neutral-600">{document.client.email}</p>}
          {document.client.phone && <p className="text-neutral-600">{document.client.phone}</p>}
          {(billed?.gstin || billed?.panNumber) && (
            <div className="mt-2 space-y-0.5 text-xs text-neutral-500">
              {billed.gstin && <p>GSTIN: {billed.gstin}</p>}
              {billed.panNumber && <p>PAN: {billed.panNumber}</p>}
            </div>
          )}
        </div>
        <div className="max-w-xs text-right">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">For</p>
          <p className="mt-2 font-medium">{document.title}</p>
          {document.project && <p className="text-neutral-600">{document.project.name}</p>}
        </div>
      </section>

      {/* Line items */}
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-y border-neutral-200 text-xs uppercase tracking-wide text-neutral-500">
            <th scope="col" className="py-2 pr-3 text-left font-semibold">
              Description
            </th>
            <th scope="col" className="w-20 py-2 px-2 text-right font-semibold">
              Qty
            </th>
            <th scope="col" className="w-28 py-2 px-2 text-right font-semibold">
              Rate
            </th>
            <th scope="col" className="w-32 py-2 pl-2 text-right font-semibold">
              Amount
            </th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line, index) => (
            <tr key={line.id ?? index} className="print-avoid-break border-b border-neutral-100 align-top">
              <td className="py-2.5 pr-3 whitespace-pre-line">{line.description}</td>
              <td className="py-2.5 px-2 text-right tabular-nums">
                {line.quantity}
                {line.unit ? ` ${line.unit}` : ""}
              </td>
              <td className="py-2.5 px-2 text-right tabular-nums">{money(line.unitPrice)}</td>
              <td className="py-2.5 pl-2 text-right tabular-nums">
                {money(line.quantity * line.unitPrice)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals */}
      <section className="print-avoid-break mt-6 flex justify-end">
        <dl className="w-full max-w-xs space-y-1.5">
          <div className="flex justify-between">
            <dt className="text-neutral-600">Subtotal</dt>
            <dd className="tabular-nums">{money(totals.subtotal)}</dd>
          </div>
          {totals.discountAmount > 0 && (
            <>
              <div className="flex justify-between">
                <dt className="text-neutral-600">
                  Discount ({toNumber(document.discountPercent)}%)
                </dt>
                <dd className="tabular-nums">−{money(totals.discountAmount)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-neutral-600">Taxable value</dt>
                <dd className="tabular-nums">{money(totals.taxableAmount)}</dd>
              </div>
            </>
          )}
          {document.taxType === "CGST_SGST" ? (
            <>
              <div className="flex justify-between">
                <dt className="text-neutral-600">CGST ({half}%)</dt>
                <dd className="tabular-nums">{money(totals.cgst)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-neutral-600">SGST ({half}%)</dt>
                <dd className="tabular-nums">{money(totals.sgst)}</dd>
              </div>
            </>
          ) : (
            <div className="flex justify-between">
              <dt className="text-neutral-600">IGST ({toNumber(document.taxPercent)}%)</dt>
              <dd className="tabular-nums">{money(totals.igst)}</dd>
            </div>
          )}
          <div className="flex justify-between border-t border-neutral-300 pt-2 text-base font-semibold">
            <dt>Total</dt>
            <dd className="tabular-nums">{money(totals.totalAmount)}</dd>
          </div>
        </dl>
      </section>

      {/* Payment instructions, terms, signature */}
      <footer className="print-avoid-break mt-8 space-y-6 border-t border-neutral-200 pt-6 text-xs">
        {typeof company.bankName === "string" && company.bankName && (
          <div>
            <p className="font-semibold uppercase tracking-[0.18em] text-neutral-500">Payment details</p>
            <dl className="mt-2 grid gap-x-8 gap-y-1 sm:grid-cols-2">
              {(
                [
                  ["Bank", company.bankName],
                  ["Account name", company.bankAccountName],
                  ["Account number", company.bankAccountNumber],
                  ["IFSC", company.bankIfsc],
                  ["Branch", company.bankBranch],
                  ["HSN / SAC", company.hsnNumber],
                ] as const
              )
                .filter(([, value]) => typeof value === "string" && value)
                .map(([label, value]) => (
                  <div key={label} className="flex gap-2">
                    <dt className="text-neutral-500">{label}</dt>
                    <dd className="font-medium">{String(value)}</dd>
                  </div>
                ))}
            </dl>
          </div>
        )}

        {document.terms && (
          <div>
            <p className="font-semibold uppercase tracking-[0.18em] text-neutral-500">
              Terms &amp; conditions
            </p>
            <p className="mt-2 whitespace-pre-line text-neutral-700">{document.terms}</p>
          </div>
        )}

        {document.notes && (
          <div>
            <p className="font-semibold uppercase tracking-[0.18em] text-neutral-500">Notes</p>
            <p className="mt-2 whitespace-pre-line text-neutral-700">{document.notes}</p>
          </div>
        )}

        <div className="flex items-end justify-between gap-6 pt-4">
          <p className="text-neutral-500">
            This is a computer-generated {kind.toLowerCase()}.
          </p>
          <div className="text-center min-w-[160px]">
            {typeof company.signature === "string" && company.signature ? (
              // eslint-disable-next-line @next/next/no-img-element -- print fidelity: no Next/Image proxy
              <img
                src={company.signature}
                alt="Authorised signature"
                className="mx-auto mb-1 h-14 max-w-[180px] object-contain"
              />
            ) : (
              <div className="mb-1 h-14" />
            )}
            <p className="border-t border-neutral-300 pt-1 text-neutral-700 font-medium">
              Authorised Signatory
            </p>
            <p className="text-[11px] text-neutral-500">
              For {String(company.name || "")}
            </p>
          </div>
        </div>
      </footer>
    </article>
  )
}
