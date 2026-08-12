import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, Plus, Trash2 } from "lucide-react";
import { useRef } from "react";

export interface EditableLine {
    description: string;
    quantity: number;
    unit?: string;
    unitPrice: number;
}

interface LineItemsEditorProps {
    lines: EditableLine[];
    onChange: (lines: EditableLine[]) => void;
    currency: string;
    discountPercent?: number;
    taxPercent?: number;
}

const emptyLine = (): EditableLine => ({ description: "", quantity: 1, unit: "", unitPrice: 0 });

const LineItemsEditor = ({ lines, onChange, currency, discountPercent = 0, taxPercent = 0 }: LineItemsEditorProps) => {
    const lastDescriptionRef = useRef<HTMLInputElement>(null);

    const updateLine = (index: number, patch: Partial<EditableLine>) => {
        onChange(lines.map((line, i) => (i === index ? { ...line, ...patch } : line)));
    };

    const removeLine = (index: number) => {
        onChange(lines.filter((_, i) => i !== index));
    };

    const duplicateLine = (index: number) => {
        onChange([...lines.slice(0, index + 1), { ...lines[index] }, ...lines.slice(index + 1)]);
    };

    const addLine = () => {
        onChange([...lines, emptyLine()]);
        requestAnimationFrame(() => lastDescriptionRef.current?.focus());
    };

    const handleLastCellTab = (index: number, event: React.KeyboardEvent) => {
        if (event.key === "Tab" && !event.shiftKey && index === lines.length - 1) {
            event.preventDefault();
            addLine();
        }
    };

    const subTotal = lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);
    const discountAmount = subTotal * (discountPercent / 100);
    const taxableAmount = subTotal - discountAmount;
    const taxAmount = taxableAmount * (taxPercent / 100);
    const total = taxableAmount + taxAmount;

    return (
        <div className="space-y-3">
            <div className="rounded-lg border border-border overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="bg-neutral-50 dark:bg-slate-800/60 text-xs uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                            <th className="text-left font-semibold px-3 py-2.5 w-[40%]">Description</th>
                            <th className="text-left font-semibold px-3 py-2.5">Qty</th>
                            <th className="text-left font-semibold px-3 py-2.5">Unit</th>
                            <th className="text-left font-semibold px-3 py-2.5">Unit Price</th>
                            <th className="text-right font-semibold px-3 py-2.5">Total</th>
                            <th className="w-20" />
                        </tr>
                    </thead>
                    <tbody>
                        {lines.map((line, index) => (
                            <tr key={index} className="border-t border-border">
                                <td className="px-3 py-2">
                                    <Input
                                        ref={index === lines.length - 1 ? lastDescriptionRef : undefined}
                                        value={line.description}
                                        onChange={(event) => updateLine(index, { description: event.target.value })}
                                        placeholder="Item or service description"
                                        className="h-9"
                                    />
                                </td>
                                <td className="px-3 py-2">
                                    <Input
                                        type="number"
                                        min={0}
                                        step="0.01"
                                        value={line.quantity}
                                        onChange={(event) => updateLine(index, { quantity: Number(event.target.value) })}
                                        className="h-9 w-20"
                                    />
                                </td>
                                <td className="px-3 py-2">
                                    <Input
                                        value={line.unit ?? ""}
                                        onChange={(event) => updateLine(index, { unit: event.target.value })}
                                        placeholder="hr, month..."
                                        className="h-9 w-24"
                                    />
                                </td>
                                <td className="px-3 py-2">
                                    <Input
                                        type="number"
                                        min={0}
                                        step="0.01"
                                        value={line.unitPrice}
                                        onChange={(event) => updateLine(index, { unitPrice: Number(event.target.value) })}
                                        onKeyDown={(event) => handleLastCellTab(index, event)}
                                        className="h-9 w-28"
                                    />
                                </td>
                                <td className="px-3 py-2 text-right font-medium text-neutral-900 dark:text-white whitespace-nowrap">
                                    {currency} {(line.quantity * line.unitPrice).toFixed(2)}
                                </td>
                                <td className="px-3 py-2">
                                    <div className="flex items-center justify-end gap-1">
                                        <Button
                                            type="button"
                                            size="icon-sm"
                                            variant="ghost"
                                            aria-label="Duplicate line"
                                            className="text-neutral-500"
                                            onClick={() => duplicateLine(index)}
                                        >
                                            <Copy className="w-4 h-4" />
                                        </Button>
                                        <Button
                                            type="button"
                                            size="icon-sm"
                                            variant="ghost"
                                            aria-label="Remove line"
                                            className="text-destructive"
                                            onClick={() => removeLine(index)}
                                            disabled={lines.length <= 1}
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <Button type="button" size="sm" variant="outline" className="h-9 rounded-lg" onClick={addLine}>
                <Plus className="w-3.5 h-3.5" />
                Add Line
            </Button>

            <div className="rounded-lg border border-border bg-neutral-50 dark:bg-slate-800/40 px-4 py-3 ml-auto max-w-xs space-y-1.5 text-sm">
                <div className="flex justify-between text-neutral-500 dark:text-neutral-400">
                    <span>Subtotal</span>
                    <span>{currency} {subTotal.toFixed(2)}</span>
                </div>
                {discountPercent > 0 && (
                    <div className="flex justify-between text-neutral-500 dark:text-neutral-400">
                        <span>Discount ({discountPercent}%)</span>
                        <span>-{currency} {discountAmount.toFixed(2)}</span>
                    </div>
                )}
                {taxPercent > 0 && (
                    <div className="flex justify-between text-neutral-500 dark:text-neutral-400">
                        <span>Tax ({taxPercent}%)</span>
                        <span>{currency} {taxAmount.toFixed(2)}</span>
                    </div>
                )}
                <div className="flex justify-between font-semibold text-neutral-900 dark:text-white pt-1.5 border-t border-border">
                    <span>Total</span>
                    <span>{currency} {total.toFixed(2)}</span>
                </div>
            </div>
        </div>
    );
};

export { emptyLine };
export default LineItemsEditor;
