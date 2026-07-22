import { NextResponse } from "next/server";
import { driveErrorResponse, requireDriveAccessToken } from "@/lib/driveRouteHelpers";
import { ensureCommonFolder, ensureRootFolder } from "@/lib/googleDrive";

/**
 * Ensures the "homebuyer-agent" root folder and its "common" subfolder
 * exist in the signed-in user's Drive. Safe to call repeatedly - it never
 * creates duplicates because folders are looked up by name first.
 */
export async function GET() {
  const authResult = await requireDriveAccessToken();
  if (!authResult.ok) return authResult.error;

  try {
    const root = await ensureRootFolder(authResult.accessToken);
    const common = await ensureCommonFolder(authResult.accessToken);
    return NextResponse.json({ root, common });
  } catch (error) {
    return driveErrorResponse(error);
  }
}
