import { NextResponse } from "next/server";
import { ANY_HOME_TYPE } from "@/lib/listings";
import { currentProviderLabel, fetchListings } from "@/lib/listingProviders";

/**
 * Read-only listings endpoint used by the search dashboard. Provider
 * selection and any credentials live server-side; the client just posts its
 * filters and gets back a normalized Listing[].
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query") ?? "";
  const homeType = searchParams.get("homeType") ?? ANY_HOME_TYPE;
  const rawMaxPrice = Number(searchParams.get("maxPrice"));
  const maxPrice = Number.isFinite(rawMaxPrice) && rawMaxPrice > 0 ? rawMaxPrice : 1_500_000;
  const rawComfortable = Number(searchParams.get("comfortable"));
  const comfortable = Number.isFinite(rawComfortable) && rawComfortable > 0 ? rawComfortable : undefined;

  try {
    const listings = await fetchListings({ query, homeType, maxPrice, comfortable });
    return NextResponse.json({ listings, provider: currentProviderLabel() });
  } catch (error) {
    console.error("Listings fetch failed", error);
    return NextResponse.json({ error: "Could not load listings. Please try again." }, { status: 502 });
  }
}
