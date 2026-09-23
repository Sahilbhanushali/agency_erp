import ConfirmDialog from "@/components/shared/ConfirmDialog";
import DatePicker from "@/components/shared/DatePicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api, ApiError } from "@/lib/api";
import type { Invoice, PaymentMethod, RecordPaymentPayload } from "@/types/invoice";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "react-toastify";

const METHODS: PaymentMethod[] = ["BANK_TRANSFER", "CASH", "CHEQUE", "STRIPE", "RAZORPAY", "UPI", "OTHER"];

interface PaymentsPanelProps {
    invoice: Invoice;
    onChange: (invoice: Invoice) => void;
}

const PaymentsPanel = ({ invoice, onChange }: PaymentsPanelProps) => {
    const [amount, setAmount] = useState("");
    const [method, setMethod] = useState<PaymentMethod>("BANK_TRANSFER");
    const [transactionRef, setTransactionRef] = useState("");
    const [note, setNote] = useState("");
    const [paidAt, setPaidAt] = useState<string | undefined>(new Date().toISOString().slice(0, 10));
    const [isRecording, setIsRecording] = useState(false);
    const [paymentToDelete, setPaymentToDelete] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [formError, setFormError] = useState<string | undefined>(undefined);

    const handleRecord = async () => {
        const numericAmount = Number(amount);
        if (!amount.trim() || Number.isNaN(numericAmount) || numericAmount <= 0) {
            setFormError("Enter an amount greater than 0.");
            return;
        }
        if (numericAmount > invoice.balanceDue) {
            setFormError(`Amount cannot exceed the balance due (${invoice.currency} ${invoice.balanceDue.toFixed(2)}).`);
            return;
        }
        if (!paidAt) {
            setFormError("Select the date the payment was made.");
            return;
        }
        setFormError(undefined);
        setIsRecording(true);
        try {
            const payload: RecordPaymentPayload = {
                amount: numericAmount, method, transactionRef: transactionRef || undefined,
                note: note || undefined, paidAt,
            };
            const updated = await api.post<Invoice>(`/invoices/${invoice.id}/payments`, payload);
            onChange(updated);
            toast.success("Payment recorded.");
            setAmount("");
            setTransactionRef("");
            setNote("");
        } catch (error) {
            toast.error(error instanceof ApiError ? error.message : "Failed to record payment.");
        } finally {
            setIsRecording(false);
        }
    };

    const handleRemove = async () => {
        if (!paymentToDelete) return;
        setIsDeleting(true);
        try {
            const updated = await api.delete<Invoice>(`/invoices/${invoice.id}/payments/${paymentToDelete}`);
            onChange(updated);
            toast.success("Payment removed.");
            setPaymentToDelete(null);
        } catch (error) {
            toast.error(error instanceof ApiError ? error.message : "Failed to remove payment.");
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between text-sm">
                <span className="text-neutral-500 dark:text-neutral-400">Total Paid</span>
                <span className="font-semibold text-success">{invoice.currency} {invoice.amountPaid.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between text-sm pb-3 border-b border-border">
                <span className="text-neutral-500 dark:text-neutral-400">Balance Due</span>
                <span className={`font-semibold ${invoice.balanceDue > 0 ? "text-destructive" : "text-success"}`}>
                    {invoice.currency} {invoice.balanceDue.toFixed(2)}
                </span>
            </div>

            {invoice.payments.length > 0 && (
                <ul className="divide-y divide-border rounded-lg border border-border">
                    {invoice.payments.map((payment) => (
                        <li key={payment.id} className="flex items-center justify-between px-3 py-2 text-sm">
                            <div>
                                <p className="font-medium text-neutral-900 dark:text-white">{invoice.currency} {Number(payment.amount).toFixed(2)}</p>
                                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                                    {payment.method.replace("_", " ")} · {payment.paidAt.slice(0, 10)}
                                    {payment.transactionRef && ` · ${payment.transactionRef}`}
                                </p>
                            </div>
                            <Button
                                type="button"
                                size="icon-sm"
                                variant="ghost"
                                aria-label="Remove payment"
                                className="text-destructive"
                                onClick={() => setPaymentToDelete(payment.id)}
                            >
                                <Trash2 className="w-4 h-4" />
                            </Button>
                        </li>
                    ))}
                </ul>
            )}

            <div className="grid grid-cols-2 gap-2">
                <Input
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="Amount"
                    value={amount}
                    onChange={(event) => { setAmount(event.target.value); setFormError(undefined); }}
                    className="h-10"
                />
                <Select value={method} onValueChange={(value) => setMethod(value as PaymentMethod)}>
                    <SelectTrigger className="h-10 !w-full">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {METHODS.map((option) => (
                            <SelectItem key={option} value={option}>{option.replace("_", " ")}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <DatePicker value={paidAt} onChange={setPaidAt} placeholder="Paid on" />
                <Input placeholder="Transaction ref (optional)" value={transactionRef} onChange={(event) => setTransactionRef(event.target.value)} className="h-10" />
                <div className="col-span-2">
                    <Input placeholder="Note (optional)" value={note} onChange={(event) => setNote(event.target.value)} className="h-10" />
                </div>
            </div>
            {formError && <p className="text-sm text-destructive">{formError}</p>}
            <Button type="button" className="h-10 rounded-lg w-full" onClick={handleRecord} disabled={isRecording}>
                {isRecording ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Record Payment
            </Button>

            <ConfirmDialog
                open={!!paymentToDelete}
                onOpenChange={(open) => !open && setPaymentToDelete(null)}
                title="Remove payment"
                description="Are you sure you want to remove this payment record?"
                isLoading={isDeleting}
                onConfirm={handleRemove}
            />
        </div>
    );
};

export default PaymentsPanel;
