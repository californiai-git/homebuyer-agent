/**
 * Turns a listing's price into a "Comfortable / Stretch / Over capacity"
 * badge relative to a comfortable monthly payment. Shared between mock
 * data (pre-computed at author time) and live provider data (computed at
 * fetch time) so the UI treats them identically.
 */

// Rough all-in monthly payment as a fraction of price (P&I + tax + insurance
// + HOA). Tuned so the existing mock listings keep the same fit labels they
// had when they were hand-authored.
const MONTHLY_COST_RATIO = 0.0066;

/** Demo buyer plan's comfortable monthly payment (used in the hero and fit calc). */
export const COMFORTABLE_MONTHLY_PAYMENT = 4200;

export type FitLabel = "Comfortable" | "Stretch" | "Over capacity";

export function estimateMonthlyCost(price: number): number {
  return Math.round(price * MONTHLY_COST_RATIO);
}

export function fitFor(monthly: number, comfortable: number = COMFORTABLE_MONTHLY_PAYMENT): FitLabel {
  if (monthly <= comfortable) return "Comfortable";
  if (monthly <= comfortable * 1.2) return "Stretch";
  return "Over capacity";
}

const COLOR_PALETTE = ["coral", "blue", "green", "gold"] as const;

/** Deterministic house-card color for an entry, so it doesn't jump on every re-render. */
export function colorForIndex(index: number): string {
  return COLOR_PALETTE[index % COLOR_PALETTE.length];
}
