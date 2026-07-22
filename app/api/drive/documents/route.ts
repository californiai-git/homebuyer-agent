import { NextResponse } from "next/server";
import { validateDocumentFile } from "@/lib/documentPolicy";
import { driveErrorResponse, requireDriveAccessToken } from "@/lib/driveRouteHelpers";
import {
  deleteFile,
  ensureCommonFolder,
  ensureHouseFolder,
  findCommonFolder,
  findHouseFolder,
  listFiles,
  uploadFile
} from "@/lib/googleDrive";

type ParsedScope = { scope: "common" } | { scope: "house"; address: string };

/**
 * Every request is keyed by `{ scope, address }` rather than a raw Drive
 * folder id supplied by the client: the server always resolves (or creates)
 * the correct folder itself. This keeps the upload/list/delete endpoints
 * from ever trusting a client-supplied folder id.
 */
function parseScope(scope: string | null, address: string | null): ParsedScope | null {
  if (scope === "common") return { scope: "common" };
  if (scope === "house" && address && address.trim()) return { scope: "house", address: address.trim() };
  return null;
}

export async function GET(request: Request) {
  const authResult = await requireDriveAccessToken();
  if (!authResult.ok) return authResult.error;

  const { searchParams } = new URL(request.url);
  const parsed = parseScope(searchParams.get("scope"), searchParams.get("address"));
  if (!parsed) {
    return NextResponse.json({ error: "A valid scope (and address, for house scope) is required." }, { status: 400 });
  }

  try {
    const folder = parsed.scope === "common"
      ? await findCommonFolder(authResult.accessToken)
      : await findHouseFolder(authResult.accessToken, parsed.address);

    // No folder yet means no documents have been uploaded for this scope -
    // return an empty list instead of creating a folder just to view it.
    if (!folder) {
      return NextResponse.json({ files: [] });
    }

    const files = await listFiles(authResult.accessToken, folder.id);
    return NextResponse.json({ files });
  } catch (error) {
    return driveErrorResponse(error);
  }
}

export async function POST(request: Request) {
  const authResult = await requireDriveAccessToken();
  if (!authResult.ok) return authResult.error;

  const form = await request.formData();
  const scopeValue = form.get("scope");
  const addressValue = form.get("address");
  const parsed = parseScope(
    typeof scopeValue === "string" ? scopeValue : null,
    typeof addressValue === "string" ? addressValue : null
  );
  if (!parsed) {
    return NextResponse.json({ error: "A valid scope (and address, for house scope) is required." }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "A file is required." }, { status: 400 });
  }

  const validationError = validateDocumentFile(file);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  try {
    const folder = parsed.scope === "common"
      ? await ensureCommonFolder(authResult.accessToken)
      : await ensureHouseFolder(authResult.accessToken, parsed.address);

    const uploaded = await uploadFile(authResult.accessToken, folder.id, file);
    return NextResponse.json({ file: uploaded }, { status: 201 });
  } catch (error) {
    return driveErrorResponse(error);
  }
}

export async function DELETE(request: Request) {
  const authResult = await requireDriveAccessToken();
  if (!authResult.ok) return authResult.error;

  const { searchParams } = new URL(request.url);
  const fileId = searchParams.get("fileId");
  if (!fileId) {
    return NextResponse.json({ error: "A fileId is required." }, { status: 400 });
  }

  try {
    await deleteFile(authResult.accessToken, fileId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return driveErrorResponse(error);
  }
}
