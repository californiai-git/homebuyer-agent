import { NextResponse } from "next/server";
import { fetchListings } from "@/lib/listingProviders";
import { sendNewMatchesEmail } from "@/lib/email";
import { dbErrorResponse } from "@/lib/db";
import { getSeenListingIds, listAllSavedSearches, markListingsSeen } from "@/lib/savedSearches";

/**
 * Daily saved-search alert job, triggered by Vercel Cron (see vercel.json).
 * Requires `CRON_SECRET` to be set - Vercel automatically sends it as a
 * bearer token for scheduled invocations, so any request without a matching
 * token (including unauthenticated public requests) is rejected.
 */
export async function GET(request: Request) {
  const expectedSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (!expectedSecret || authHeader !== `Bearer ${expectedSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const searches = await listAllSavedSearches();
    let emailsSent = 0;

    for (const search of searches) {
      const matches = await fetchListings({ query: search.query, maxPrice: search.maxPrice, homeType: search.homeType });
      const seen = await getSeenListingIds(search.id);
      const newMatches = matches.filter((listing) => !seen.has(listing.id));

      if (newMatches.length > 0) {
        await sendNewMatchesEmail({
          to: search.ownerEmail,
          savedSearchName: search.name,
          matches: newMatches
        });
        emailsSent += 1;
      }

      // Record every currently-matching listing as seen (not just the new
      // ones) so nothing gets re-emailed tomorrow unless it's genuinely new.
      await markListingsSeen(search.id, matches.map((listing) => listing.id));
    }

    return NextResponse.json({ ok: true, checked: searches.length, emailsSent });
  } catch (error) {
    return dbErrorResponse(error);
  }
}
