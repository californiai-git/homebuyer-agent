import { requireSql } from "./db";

export type AffordabilityFormula = "cash_flow" | "28_percent";

export type FinancialProfile = {
  formula: AffordabilityFormula;
  manualOverride: number | null;
};

const DEFAULT_PROFILE: FinancialProfile = { formula: "cash_flow", manualOverride: null };

type Row = {
  affordability_formula: AffordabilityFormula;
  manual_override: number | null;
};

export async function getProfile(ownerSub: string): Promise<FinancialProfile> {
  const sql = requireSql();
  const rows = (await sql`
    select affordability_formula, manual_override
    from financial_profiles
    where owner_sub = ${ownerSub}
  `) as Row[];
  const row = rows[0];
  if (!row) return DEFAULT_PROFILE;
  return { formula: row.affordability_formula, manualOverride: row.manual_override };
}

export async function upsertProfile(ownerSub: string, patch: Partial<FinancialProfile>): Promise<FinancialProfile> {
  const sql = requireSql();
  const current = await getProfile(ownerSub);
  const formula = patch.formula ?? current.formula;
  const manualOverride = patch.manualOverride === undefined ? current.manualOverride : patch.manualOverride;

  await sql`
    insert into financial_profiles (owner_sub, affordability_formula, manual_override, updated_at)
    values (${ownerSub}, ${formula}, ${manualOverride}, now())
    on conflict (owner_sub) do update set
      affordability_formula = excluded.affordability_formula,
      manual_override = excluded.manual_override,
      updated_at = now()
  `;
  return { formula, manualOverride };
}
