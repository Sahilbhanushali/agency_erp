/**
 * The HR profile holds an employee's salary (`User.currentSalary` in rupees, per
 * `User.salaryFrequency`). A salary structure is that salary split by a template, so
 * both the assign screen and the server derive the monthly gross from here, and nobody
 * types the salary twice.
 */

export type SplitTemplate = {
  basicPercentage: number
  hraPercentage: number
  specialPercentage: number
}

/** Used when no template exists at all. */
export const FALLBACK_SPLIT: SplitTemplate = { basicPercentage: 50, hraPercentage: 25, specialPercentage: 15 }

/**
 * Monthly gross in rupees, or null when the profile can't give one: no salary, or an
 * hourly / project-based rate, which has no fixed month.
 */
export function monthlyGrossFromProfile(currentSalary: unknown, frequency: string | null | undefined): number | null {
  const amount = Number(currentSalary == null ? NaN : String(currentSalary))
  if (!Number.isFinite(amount) || amount <= 0) return null
  const f = frequency || "MONTHLY"
  if (f === "MONTHLY") return Math.round(amount * 100) / 100
  if (f === "YEARLY") return Math.round((amount / 12) * 100) / 100
  return null
}

/** Why monthlyGrossFromProfile gave null, in words for HR. */
export function profileSalaryProblem(currentSalary: unknown, frequency: string | null | undefined): string | null {
  if (monthlyGrossFromProfile(currentSalary, frequency) !== null) return null
  const amount = Number(currentSalary == null ? NaN : String(currentSalary))
  if (!Number.isFinite(amount) || amount <= 0) return "No salary on the HR profile"
  return `Salary is ${String(frequency).toLowerCase().replace("_", "-")} — set a monthly or yearly salary on the HR profile`
}

/** Splits a monthly gross (paise) into the structure's components; "other" takes the rounding. */
export function splitGross(grossPaise: number, t: SplitTemplate | null | undefined) {
  const s = t ?? FALLBACK_SPLIT
  const basicSalary = Math.round(grossPaise * (s.basicPercentage / 100))
  const hra = Math.round(grossPaise * (s.hraPercentage / 100))
  const specialAllowance = Math.round(grossPaise * (s.specialPercentage / 100))
  return { basicSalary, hra, specialAllowance, otherAllowances: Math.max(0, grossPaise - basicSalary - hra - specialAllowance) }
}

/** The salary as the HR profile stores it, for a monthly gross in paise. */
export function profileSalaryFor(monthlyGrossPaise: number, frequency: string | null | undefined): number | null {
  const f = frequency || "MONTHLY"
  if (f === "MONTHLY") return monthlyGrossPaise / 100
  if (f === "YEARLY") return (monthlyGrossPaise * 12) / 100
  return null // hourly / project-based: the structure can't say what the rate is
}
