import { numberToIndianWords } from "@/lib/numberToWords";
import type { EditableLine } from "./LineItemsEditor";

interface DocumentPreviewProps {
    kind: "Quotation" | "Invoice";
    documentNumber: string;
    documentDate?: string;
    status: string;
    companyName: string;
    companyLogoUrl?: string;
    companyAddress?: string;
    companyEmail?: string;
    companyPhone?: string;
    companyWebsite?: string;
    companyGstNumber?: string;
    bankName?: string;
    bankAccountName?: string;
    bankAccountNumber?: string;
    bankIfsc?: string;
    clientName: string;
    clientEmail: string;
    clientGstNumber?: string;
    title: string;
    dateLabel: string;
    dateValue?: string;
    lines: EditableLine[];
    currency: string;
    discountPercent: number;
    taxPercent: number;
    terms?: string;
    note?: string;
    signatureUrl?: string;
}

const formatAmount = (value: number) =>
    new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(Math.round(value));

const DocumentPreview = ({
    kind,
    documentNumber,
    documentDate,
    status,
    companyName,
    companyLogoUrl,
    companyAddress,
    companyEmail,
    companyPhone,
    companyWebsite,
    companyGstNumber,
    bankName,
    bankAccountName,
    bankAccountNumber,
    bankIfsc,
    clientName,
    clientEmail,
    clientGstNumber,
    title,
    dateLabel,
    dateValue,
    lines,
    currency,
    discountPercent,
    taxPercent,
    terms,
    note,
    signatureUrl,
}: DocumentPreviewProps) => {
    const subTotal = lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);
    const discountAmount = subTotal * (discountPercent / 100);
    const taxableAmount = subTotal - discountAmount;
    const halfTaxPercent = taxPercent / 2;
    const sgstAmount = taxableAmount * (halfTaxPercent / 100);
    const cgstAmount = taxableAmount * (halfTaxPercent / 100);
    const total = taxableAmount + sgstAmount + cgstAmount;
    const currencySymbol = currency === "INR" ? "₹." : `${currency} `;
    const hasBankInfo = bankName || bankAccountName || bankAccountNumber || bankIfsc;
    const amountInWords = numberToIndianWords(total, "").replace(/\s+/g, " ").trim();

    return (
        <div id="doc-print-area" className="bg-white text-neutral-900 rounded-xl border border-border shadow-sm max-w-[820px] mx-auto print:shadow-none print:border-0 print:rounded-none overflow-hidden">
            <div className="p-8 pb-6">
                <div className="flex items-start justify-between gap-6 mb-10">
                    <div className="text-xs text-neutral-500 space-y-1.5">
                        <p>
                            <span className="uppercase tracking-wide">{kind === "Invoice" ? "Tax Invoice No" : "Quotation No"}</span>
                            <span className="ml-4 font-bold text-neutral-900">{documentNumber}</span>
                        </p>
                        {documentDate && (
                            <p>
                                <span className="uppercase tracking-wide">Date Issued</span>
                                <span className="ml-4 font-bold text-neutral-900">{documentDate}</span>
                            </p>
                        )}
                        {dateValue && (
                            <p>
                                <span className="uppercase tracking-wide">{dateLabel}</span>
                                <span className="ml-4 font-bold text-neutral-900">{dateValue}</span>
                            </p>
                        )}
                        <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-medium border border-neutral-300 text-neutral-500">
                            {status}
                        </span>
                    </div>

                    {hasBankInfo && (
                        <div className="text-xs text-neutral-600 space-y-1 shrink-0 max-w-[220px]">
                            <p className="font-semibold text-neutral-900 uppercase tracking-wide mb-1.5">Bank Info</p>
                            {bankAccountName && <p><span className="font-semibold">Acc Name /</span> {bankAccountName}</p>}
                            {bankName && <p><span className="font-semibold">Bank /</span> {bankName}</p>}
                            {bankAccountNumber && <p><span className="font-semibold">Acc No /</span> {bankAccountNumber}</p>}
                            {bankIfsc && <p><span className="font-semibold">IFSC /</span> {bankIfsc}</p>}
                            {companyGstNumber && <p className="pt-1"><span className="font-semibold">GST No.:</span> {companyGstNumber}</p>}
                        </div>
                    )}
                </div>

                <h1 className="text-4xl font-bold tracking-[0.15em] uppercase text-neutral-900 mb-8">
                    {kind === "Invoice" ? "Tax Invoice" : "Quotation"}
                </h1>

                <div className="mb-8">
                    <p className="text-xs uppercase tracking-wide text-neutral-500 mb-1">
                        Issued To <span className="font-bold text-neutral-900 normal-case text-sm ml-2">{clientName || "—"}</span>
                    </p>
                    {clientEmail && <p className="text-sm text-neutral-500">{clientEmail}</p>}
                    {clientGstNumber && <p className="text-sm font-semibold text-neutral-900 mt-1">GST No.: {clientGstNumber}</p>}
                </div>

                <table className="w-full text-sm mb-6">
                    <thead>
                        <tr className="border-b border-t border-neutral-800 text-xs uppercase tracking-wide text-neutral-500">
                            <th className="text-left font-semibold py-2.5">Particular</th>
                            <th className="text-right font-semibold py-2.5">Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        {title.trim() && (
                            <tr>
                                <td colSpan={2} className="pt-4 pb-1 font-semibold text-neutral-900">
                                    (+) {title.toUpperCase()}
                                </td>
                            </tr>
                        )}
                        {lines.map((line, index) => (
                            <tr key={index}>
                                <td className="py-1 pl-4 text-neutral-700">
                                    {line.description || "—"}
                                    {(line.quantity !== 1 || line.unit) && (
                                        <span className="text-neutral-400 ml-2 text-xs">
                                            ({line.quantity}{line.unit ? ` ${line.unit}` : ""} × {currencySymbol}{formatAmount(line.unitPrice)})
                                        </span>
                                    )}
                                </td>
                                <td className="py-1 text-right whitespace-nowrap text-neutral-700">
                                    {formatAmount(line.quantity * line.unitPrice)}/-
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                <div className="flex justify-between items-start gap-6 mb-8 border-t border-neutral-800 pt-3">
                    <p className="text-xs font-semibold text-neutral-700 max-w-[380px] pt-1.5 uppercase">
                        {amountInWords}
                    </p>
                    <div className="w-64 space-y-1.5 text-sm shrink-0">
                        <div className="flex justify-between">
                            <span className="text-neutral-600">Total {currencySymbol}</span>
                            <span className="font-medium">{formatAmount(subTotal)}/-</span>
                        </div>
                        {discountPercent > 0 && (
                            <div className="flex justify-between">
                                <span className="text-neutral-600">Discount ({discountPercent}%)</span>
                                <span className="font-medium">-{formatAmount(discountAmount)}/-</span>
                            </div>
                        )}
                        {taxPercent > 0 && (
                            <>
                                <div className="flex justify-between">
                                    <span className="text-neutral-600">{halfTaxPercent}% SGST {currencySymbol}</span>
                                    <span className="font-medium">{formatAmount(sgstAmount)}/-</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-neutral-600">{halfTaxPercent}% CGST {currencySymbol}</span>
                                    <span className="font-medium">{formatAmount(cgstAmount)}/-</span>
                                </div>
                            </>
                        )}
                        <div className="flex justify-between text-base font-bold text-neutral-900 pt-1.5 border-t border-neutral-300">
                            <span>G. Total {currencySymbol}</span>
                            <span>{formatAmount(total)}/-</span>
                        </div>
                    </div>
                </div>

                {(terms || note) && (
                    <div className="space-y-3 text-xs text-neutral-500 mb-12">
                        {terms && (
                            <div>
                                <p className="font-semibold text-neutral-700 underline underline-offset-2">Terms & Conditions</p>
                                <p className="whitespace-pre-line mt-1">{terms}</p>
                            </div>
                        )}
                        {note && (
                            <div>
                                <p className="font-semibold text-neutral-700">Note</p>
                                <p className="whitespace-pre-line mt-1">{note}</p>
                            </div>
                        )}
                    </div>
                )}

                <div className="flex items-end justify-between gap-6">
                    <div className="flex items-center gap-3">
                        {companyLogoUrl ? (
                            <img src={companyLogoUrl} alt={companyName} className="h-14 w-auto max-w-[140px] object-contain" />
                        ) : (
                            <p className="font-bold text-lg text-neutral-900">{companyName || "Your Company"}</p>
                        )}
                    </div>
                    <div className="text-center text-xs text-neutral-500 space-y-0.5">
                        {companyAddress && <p className="whitespace-pre-line max-w-[220px]">{companyAddress}</p>}
                    </div>
                    <div className="text-right text-xs text-neutral-500 space-y-0.5">
                        {signatureUrl && <img src={signatureUrl} alt="Signature" className="h-14 w-auto max-w-[160px] object-contain ml-auto mb-1" />}
                        {companyWebsite && <p>{companyWebsite}</p>}
                        {companyEmail && <p>{companyEmail}</p>}
                        {companyPhone && <p>{companyPhone}</p>}
                    </div>
                </div>
            </div>

            <div className="flex justify-end">
                <div
                    className="w-3/4 h-10"
                    style={{
                        backgroundColor: "#E5231D",
                        clipPath: "polygon(0% 50%, 6% 0%, 100% 0%, 100% 100%, 6% 100%)",
                    }}
                />
            </div>
        </div>
    );
};

export default DocumentPreview;
