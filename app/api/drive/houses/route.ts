import { NextResponse } from "next/server";
import { driveErrorResponse, requireDriveAccessToken } from "@/lib/driveRouteHelpers";
import { ensureHouseFolder, listHouseFolders } from "@/lib/googleDrive";

/** Lists every per-house document folder the user has created so far. */
export async function GET() {
  const authResult = await requireDriveAccessToken();
  if (!authResult.ok) return authResult.error;

  try {
    const houses = await listHouseFolders(authResult.accessToken);
    return NextResponse.json({ houses });
  } catch (error) {
    return driveErrorResponse(error);
  }
}

/** Ensures a per-house document folder exists for the given address. */
export async function POST(request: Request) {
  const authResult = await requireDriveAccessToken();
  if (!authResult.ok) return authResult.error;

  const body = await request.json().catch(() => null);
  const address = typeof body?.address === "string" ? body.address.trim() : "";
  if (!address) {
    return NextResponse.json({ error: "An address is required." }, { status: 400 });
  }

  try {
    const folder = await ensureHouseFolder(authResult.accessToken, address);
    return NextResponse.json({ folder }, { status: 201 });
  } catch (error) {
    return driveErrorResponse(error);
  }
}
