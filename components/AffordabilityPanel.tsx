"use client";

import { useState } from "react";
import type { AffordabilitySnapshot } from "@/lib/useAffordability";

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

/**
 * Popover that lets the user pick which affordability formula to use and
 * optionally override the computed monthly payment. Rendered under the hero
 * plan card. When no pay stubs are analyzed yet, both formulas fall back to
 * the app-wide default and the popover explains what's needed.
 */
export default function AffordabilityPanel({
  snapshot,
  onFormulaChange,
  onOverrideChange
}: {
  snapshot: AffordabilitySnapshot;
  onFormulaChange: (formula: AffordabilitySnapshot["formula"]) => void;
  onOverrideChange: (value: number | null) => void;
}) {
  const [overrideInput, setOverrideInput] = useState(
    snapshot.manualOverride !== null ? String(snapshot.manualOverride) : ""
  );

  function applyOverride() {
    const trimmed = overrideInput.trim();
    if (trimmed === "") {
      onOverrideChange(null);
      return;
    }
    const value = Number(trimmed);
    if (!Number.isFinite(value) || value < 0) return;
    onOverrideChange(Math.round(value));
  }

  return (
    <div className="affordability-panel">
      <p className="affordability-source">
        {snapshot.paystubCount === 0 ? (
          <>Upload a pay stub in <strong>Common documents</strong> and click <strong>Analyze as pay stub</strong> to compute this from your real income.</>
        ) : (
          <>Based on {snapshot.paystubCount} pay stub{snapshot.paystubCount === 1 ? "" : "s"}
            {snapshot.bankStatementCount > 0 ? ` and ${snapshot.bankStatementCount} bank statement${snapshot.bankStatementCount === 1 ? "" : "s"}` : ""}.
          </>
        )}
      </p>

      <fieldset className="affordability-formulas">
        <legend>Comfortable monthly payment</legend>

        <label>
          <input
            type="radio"
            name="affordability-formula"
            checked={snapshot.formula === "cash_flow"}
            onChange={() => onFormulaChange("cash_flow")}
          />
          <span>
            <strong>Cash flow</strong>
            <small>Gross income minus recurring expenses minus 15% savings buffer</small>
            <b>{snapshot.comfortableByCashFlow !== null ? money.format(snapshot.comfortableByCashFlow) : "—"}</b>
          </span>
        </label>

        <label>
          <input
            type="radio"
            name="affordability-formula"
            checked={snapshot.formula === "28_percent"}
            onChange={() => onFormulaChange("28_percent")}
          />
          <span>
            <strong>28% of gross income</strong>
            <small>Common lender front-end ratio</small>
            <b>{snapshot.comfortableByRule28 !== null ? money.format(snapshot.comfortableByRule28) : "—"}</b>
          </span>
        </label>
      </fieldset>

      <label className="affordability-override">
        <span>Manual override</span>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          step={50}
          value={overrideInput}
          onChange={(event) => setOverrideInput(event.target.value)}
          onBlur={applyOverride}
          onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); applyOverride(); } }}
          placeholder="Leave blank to use the formula"
        />
      </label>

      {(snapshot.grossMonthlyIncome !== null || snapshot.monthlyExpenses !== null) && (
        <dl className="affordability-inputs">
          {snapshot.grossMonthlyIncome !== null && (
            <>
              <dt>Gross income</dt>
              <dd>{money.format(snapshot.grossMonthlyIncome)}/mo</dd>
            </>
          )}
          {snapshot.monthlyExpenses !== null && (
            <>
              <dt>Recurring expenses</dt>
              <dd>{money.format(snapshot.monthlyExpenses)}/mo</dd>
            </>
          )}
        </dl>
      )}
    </div>
  );
}
