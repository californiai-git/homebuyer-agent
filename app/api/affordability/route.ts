import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { dbErrorResponse } from "@/lib/db";
import { computeAffordability } from "@/lib/affordabilityCompute";
import { listAnalyses } from "@/lib/documentAnalyses";
import { getProfile, upsertProfile } from "@/lib/financialProfile";

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return { id: session.user.id };
}

/** Returns the user's current comfortable monthly payment with provenance. */
export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Sign in with Google to view your plan." }, { status: 401 });

  try {
    const [analyses, profile] = await Promise.all([listAnalyses(user.id), getProfile(user.id)]);
    return NextResponse.json({ affordability: computeAffordability(analyses, profile) });
  } catch (error) {
    return dbErrorResponse(error);
  }
}

/** Updates the user's affordability formula choice or manual override. */
export async function PATCH(request: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Sign in with Google to update your plan." }, { status: 401 });

  const body = await request.json().catch(() => null);
  const formula = body?.formula === "cash_flow" || body?.formula === "28_percent" ? body.formula : undefined;

  let manualOverride: number | null | undefined;
  if (body && "manualOverride" in body) {
    if (body.manualOverride === null) {
      manualOverride = null;
    } else {
      const value = Number(body.manualOverride);
      if (!Number.isFinite(value) || value < 0 || value > 100_000) {
        return NextResponse.json({ error: "manualOverride must be a positive number under 100000." }, { status: 400 });
      }
      manualOverride = Math.round(value);
    }
  }

  if (formula === undefined && manualOverride === undefined) {
    return NextResponse.json({ error: "Provide formula or manualOverride." }, { status: 400 });
  }

  try {
    await upsertProfile(user.id, { formula, manualOverride });
    const [analyses, profile] = await Promise.all([listAnalyses(user.id), getProfile(user.id)]);
    return NextResponse.json({ affordability: computeAffordability(analyses, profile) });
  } catch (error) {
    return dbErrorResponse(error);
  }
}
