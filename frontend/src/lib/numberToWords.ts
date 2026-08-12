const ONES = ["", "ONE", "TWO", "THREE", "FOUR", "FIVE", "SIX", "SEVEN", "EIGHT", "NINE", "TEN",
    "ELEVEN", "TWELVE", "THIRTEEN", "FOURTEEN", "FIFTEEN", "SIXTEEN", "SEVENTEEN", "EIGHTEEN", "NINETEEN"];
const TENS = ["", "", "TWENTY", "THIRTY", "FORTY", "FIFTY", "SIXTY", "SEVENTY", "EIGHTY", "NINETY"];

function threeDigitsToWords(value: number): string {
    let result = "";
    if (value >= 100) {
        result += `${ONES[Math.floor(value / 100)]} HUNDRED `;
        value %= 100;
    }
    if (value >= 20) {
        result += `${TENS[Math.floor(value / 10)]} `;
        value %= 10;
    }
    if (value > 0) result += `${ONES[value]} `;
    return result.trim();
}

/** Indian numbering system (lakh/crore), e.g. 204730 -> "TWO LAKH FOUR THOUSAND SEVEN HUNDRED THIRTY". */
export function numberToIndianWords(amount: number, currencyLabel = "RUPEES"): string {
    const rounded = Math.round(amount);
    if (rounded === 0) return `ZERO ${currencyLabel} ONLY`;

    const crore = Math.floor(rounded / 10000000);
    const lakh = Math.floor((rounded % 10000000) / 100000);
    const thousand = Math.floor((rounded % 100000) / 1000);
    const hundred = rounded % 1000;

    const parts = [
        crore > 0 && `${threeDigitsToWords(crore)} CRORE`,
        lakh > 0 && `${threeDigitsToWords(lakh)} LAKH`,
        thousand > 0 && `${threeDigitsToWords(thousand)} THOUSAND`,
        hundred > 0 && threeDigitsToWords(hundred),
    ].filter(Boolean);

    return `${parts.join(" ")} ${currencyLabel} ONLY`;
}
