import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { dbErrorResponse } from "@/lib/db";
import { driveErrorResponse, requireDriveAccessToken } from "@/lib/driveRouteHelpers";
import { deleteAnalysis, listAnalyses, upsertAnalysis } from "@/lib/documentAnalyses";
import { OpenAiNotConfiguredError, extract, type AnalysisKind } from "@/lib/openaiExtractor";

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return { id: session.user.id };
}

/** Returns every analyzed document for the signed-in user. */
export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Sign in with Google to view analyses." }, { status: 401 });

  try {
    const analyses = await listAnalyses(user.id);
    return NextResponse.json({ analyses });
  } catch (error) {
    return dbErrorResponse(error);
  }
}

/**
 * Analyzes one Drive file. Body: `{ driveFileId, fileName, kind }`. The
 * server fetches the file bytes with the user's own access token, so the
 * PDF never lives on our disk beyond the duration of this request.
 */
export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Sign in with Google to analyze documents." }, { status: 401 });

  const driveAuth = await requireDriveAccessToken();
  if (!driveAuth.ok) return driveAuth.error;

  const body = await request.json().catch(() => null);
  const driveFileId = typeof body?.driveFileId === "string" ? body.driveFileId : "";
  const fileName = typeof body?.fileName === "string" ? body.fileName.slice(0, 200) : "";
  const kindValue = body?.kind;
  const kind: AnalysisKind | null = kindValue === "paystub" || kindValue === "bank_statement" ? kindValue : null;

  if (!driveFileId || !fileName || !kind) {
    return NextResponse.json({ error: "driveFileId, fileName, and kind (paystub|bank_statement) are required." }, { status: 400 });
  }

  try {
    const download = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(driveFileId)}?alt=media`, {
      headers: { Authorization: `Bearer ${driveAuth.accessToken}` }
    });
    if (download.status === 401) {
      return NextResponse.json({ error: "Your Google session expired. Please sign in again." }, { status: 401 });
    }
    if (!download.ok) {
      const errText = await download.text().catch(() => "");
      return NextResponse.json({ error: `Could not fetch file from Drive (${download.status}): ${errText.slice(0, 200)}` }, { status: 502 });
    }
    const pdfBytes = await download.arrayBuffer();

    const { data, model } = await extract(kind, pdfBytes, fileName);
    const analysis = await upsertAnalysis({
      ownerSub: user.id,
      driveFileId,
      fileName,
      kind,
      extracted: data,
      model
    });
    return NextResponse.json({ analysis }, { status: 201 });
  } catch (error) {
    if (error instanceof OpenAiNotConfiguredError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    if (error instanceof Error && error.message.startsWith("PDF is too large")) {
      return NextResponse.json({ error: error.message }, { status: 413 });
    }
    if (error instanceof Error && (error.name === "DriveAuthError" || error.name === "DriveApiError")) {
      return driveErrorResponse(error);
    }
    console.error("Document analysis failed", error);
    return NextResponse.json({ error: "Analysis failed. Please try again." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Sign in with Google to manage analyses." }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const driveFileId = searchParams.get("driveFileId");
  if (!driveFileId) return NextResponse.json({ error: "driveFileId is required." }, { status: 400 });

  try {
    const deleted = await deleteAnalysis(user.id, driveFileId);
    if (!deleted) return NextResponse.json({ error: "Not found." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return dbErrorResponse(error);
  }
}
