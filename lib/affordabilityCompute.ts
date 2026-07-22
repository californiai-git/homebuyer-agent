import { COMFORTABLE_MONTHLY_PAYMENT } from "./affordability";
import type { DocumentAnalysis } from "./documentAnalyses";
import type { AffordabilityFormula, FinancialProfile } from "./financialProfile";
import type { BankStatementExtraction, PaystubExtraction } from "./openaiExtractor";

/**
 * Aggregates a user's uploaded pay stubs and bank statements into a single
 * "comfortable monthly payment" figure, computed via the formula they've
 * chosen on their financial profile. Falls back to the app-wide default
 * when nothing is analyzed yet.
 */

type SafetyBufferPct = number;
const CASH_FLOW_SAFETY_BUFFER: SafetyBufferPct = 0.15;
const FRONT_END_RATIO = 0.28;

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 0) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function paystubMonthlyGross(extracted: PaystubExtraction): number | null {
  if (extracted.grossPay == null || extracted.grossPay <= 0) return null;
  switch (extracted.payFrequency) {
    case "weekly":
      return extracted.grossPay * 52 / 12;
    case "biweekly":
      return extracted.grossPay * 26 / 12;
    case "semimonthly":
      return extracted.grossPay * 2;
    case "monthly":
      return extracted.grossPay;
    default:
      return null;
  }
}

export type AffordabilitySnapshot = {
  formula: AffordabilityFormula;
  manualOverride: number | null;
  comfortable: number;
  comfortableByRule28: number | null;
  comfortableByCashFlow: number | null;
  grossMonthlyIncome: number | null;
  monthlyExpenses: number | null;
  paystubCount: number;
  bankStatementCount: number;
};

export function computeAffordability(
  analyses: DocumentAnalysis[],
  profile: FinancialProfile
): AffordabilitySnapshot {
  const paystubs = analyses.filter((a) => a.kind === "paystub");
  const bankStatements = analyses.filter((a) => a.kind === "bank_statement");

  const monthlyGrossValues = paystubs
    .map((a) => paystubMonthlyGross(a.extracted as PaystubExtraction))
    .filter((v): v is number => typeof v === "number" && v > 0);
  const monthlyExpenseValues = bankStatements
    .map((a) => (a.extracted as BankStatementExtraction).recurringOutflowsMonthly)
    .filter((v): v is number => typeof v === "number" && v > 0);

  const grossMonthlyIncome = monthlyGrossValues.length > 0 ? Math.round(median(monthlyGrossValues)) : null;
  const monthlyExpenses = monthlyExpenseValues.length > 0 ? Math.round(median(monthlyExpenseValues)) : null;

  const comfortableByRule28 = grossMonthlyIncome !== null
    ? Math.round(grossMonthlyIncome * FRONT_END_RATIO)
    : null;

  const comfortableByCashFlow = grossMonthlyIncome !== null
    ? Math.max(0, Math.round(grossMonthlyIncome - (monthlyExpenses ?? 0) - grossMonthlyIncome * CASH_FLOW_SAFETY_BUFFER))
    : null;

  const chosen = profile.formula === "28_percent" ? comfortableByRule28 : comfortableByCashFlow;
  const comfortable = profile.manualOverride
    ?? chosen
    ?? COMFORTABLE_MONTHLY_PAYMENT;

  return {
    formula: profile.formula,
    manualOverride: profile.manualOverride,
    comfortable,
    comfortableByRule28,
    comfortableByCashFlow,
    grossMonthlyIncome,
    monthlyExpenses,
    paystubCount: paystubs.length,
    bankStatementCount: bankStatements.length
  };
}
