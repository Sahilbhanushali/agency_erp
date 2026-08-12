interface LineInput {
  quantity: number;
  unitPrice: number;
}

const round2 = (value: number) => Math.round(value * 100) / 100;

/** Shared by Quotations and Invoices so the two never drift on how a total is derived. */
export function computeLineTotals(
  lines: LineInput[],
  discountPercent: number,
  taxPercent: number,
) {
  const subTotal = round2(
    lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0),
  );
  const taxableAmount = round2(subTotal - subTotal * (discountPercent / 100));
  const totalAmount = round2(taxableAmount + taxableAmount * (taxPercent / 100));

  return { subTotal, totalAmount };
}
