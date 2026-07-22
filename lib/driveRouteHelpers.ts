import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { DriveApiError, DriveAuthError } from "@/lib/googleDrive";

type DriveAccessResult =
  | { ok: true; accessToken: string }
  | { ok: false; error: NextResponse };

/**
 * Confirms the caller has an active Google session before touching Drive.
 * Every Drive-backed route handler must call this first: Drive access is
 * scoped per-user via OAuth, so there is nothing to authorize beyond
 * "is this a valid, non-expired session".
 */
export async function requireDriveAccessToken(): Promise<DriveAccessResult> {
  const session = await auth();

  if (!session?.accessToken) {
    return {
      ok: false,
      error: NextResponse.json({ error: "Sign in with Google to manage documents." }, { status: 401 })
    };
  }

  if (session.error) {
    return {
      ok: false,
      error: NextResponse.json({ error: "Your Google session expired. Please sign in again." }, { status: 401 })
    };
  }

  return { ok: true, accessToken: session.accessToken };
}

/** Maps a thrown Drive error to a safe JSON response, logging unexpected failures. */
export function driveErrorResponse(error: unknown): NextResponse {
  if (error instanceof DriveAuthError) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }

  if (error instanceof DriveApiError) {
    return NextResponse.json(
      { error: "Google Drive request failed. Please try again." },
      { status: error.status >= 500 ? 502 : 400 }
    );
  }

  if (error instanceof RangeError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  console.error("Unexpected Google Drive error", error);
  return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
}
