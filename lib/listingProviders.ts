import { colorForIndex, estimateMonthlyCost, fitFor } from "./affordability";
import { ANY_HOME_TYPE, MOCK_LISTINGS, matchListings, type Listing, type SearchCriteria } from "./listings";

/**
 * Server-side listing provider dispatch. Picks between the static mock data
 * (default) and the SimplyRETS demo/live API based on env config, and
 * returns already-filtered listings matching the caller's criteria.
 */

const DEFAULT_SIMPLYRETS_URL = "https://api.simplyrets.com";
// SimplyRETS's own documented "demo" credentials for the sample data feed.
// Publishing them here is intentional and safe: the entire point of these
// credentials is to give developers zero-friction access to their read-only
// sample listings. See https://docs.simplyrets.com/api/index.html
const DEFAULT_SIMPLYRETS_AUTH = "Basic c2ltcGx5cmV0czpzaW1wbHlyZXRz";

// Small in-process cache so repeated queries in a short window (typical when
// the user tweaks filters) don't hammer the upstream API.
type CacheEntry = { at: number; listings: Listing[] };
const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 30_000;

function cacheKey(criteria: SearchCriteria): string {
  return `${criteria.homeType}|${criteria.maxPrice}|${criteria.query.toLowerCase().trim()}|${criteria.comfortable ?? "-"}`;
}

function currentProvider(): "simplyrets" | "mock" {
  return process.env.LISTINGS_PROVIDER === "simplyrets" ? "simplyrets" : "mock";
}

/** Where the currently-configured provider's data comes from, for UI attribution. */
export function currentProviderLabel(): string {
  switch (currentProvider()) {
    case "simplyrets":
      return process.env.SIMPLYRETS_AUTHORIZATION ? "SimplyRETS live feed" : "SimplyRETS demo feed (Texas sample data)";
    default:
      return "Demonstration listings";
  }
}

/** Overwrites each listing's fit label using the caller's comfortable payment. */
function reapplyFit(listings: Listing[], comfortable: number | undefined): Listing[] {
  if (comfortable === undefined || comfortable <= 0) return listings;
  return listings.map((listing) => ({ ...listing, fit: fitFor(listing.monthly, comfortable) }));
}

export async function fetchListings(criteria: SearchCriteria): Promise<Listing[]> {
  const provider = currentProvider();
  const key = `${provider}:${cacheKey(criteria)}`;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return cached.listings;
  }

  const raw = provider === "simplyrets"
    ? await fetchFromSimplyRets(criteria)
    : matchListings(MOCK_LISTINGS, criteria);

  const listings = reapplyFit(raw, criteria.comfortable);
  cache.set(key, { at: Date.now(), listings });
  return listings;
}

type SimplyRetsProperty = {
  mlsId?: number;
  listPrice?: number;
  bedrooms?: number;
  bathsFull?: number;
  bathsHalf?: number;
  property?: {
    type?: string;
    subType?: string;
    subTypeText?: string;
    area?: number;
    bedrooms?: number;
    bathsFull?: number;
    bathsHalf?: number;
  };
  address?: {
    full?: string;
    streetName?: string;
    streetNumber?: string;
    city?: string;
    state?: string;
    postalCode?: string;
  };
  photos?: string[];
  virtualTourUrl?: string;
  listingId?: string;
};

async function fetchFromSimplyRets(criteria: SearchCriteria): Promise<Listing[]> {
  // Treat empty-string env vars the same as unset (they show up as "" from
  // `.env` files), so the built-in demo credentials still apply.
  const baseUrl = process.env.SIMPLYRETS_URL || DEFAULT_SIMPLYRETS_URL;
  const authorization = process.env.SIMPLYRETS_AUTHORIZATION || DEFAULT_SIMPLYRETS_AUTH;

  const params = new URLSearchParams();
  params.set("limit", "100");
  params.set("maxprice", String(criteria.maxPrice));
  const query = criteria.query.trim();
  if (query) params.set("q", query);
  if (criteria.homeType === "House") params.set("type", "Residential");
  else if (criteria.homeType === "Condo") params.set("type", "Condominium");

  const url = `${baseUrl}/properties?${params.toString()}`;
  const response = await fetch(url, {
    headers: { Authorization: authorization, Accept: "application/json" },
    // Route Handler runs on the server; we handle our own in-process cache.
    cache: "no-store"
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`SimplyRETS request failed (${response.status}): ${body.slice(0, 200)}`);
  }

  const data = (await response.json()) as SimplyRetsProperty[];
  const normalized = data
    .map((raw, index) => normalizeSimplyRetsProperty(raw, index))
    .filter((listing): listing is Listing => listing !== null);

  // Apply the home-type filter locally too, in case the upstream type param
  // was too broad, and to guarantee "Condo" doesn't sneak into a "House" list.
  return matchListings(normalized, { ...criteria, query: "" });
}

function normalizeSimplyRetsProperty(raw: SimplyRetsProperty, index: number): Listing | null {
  const price = typeof raw.listPrice === "number" ? raw.listPrice : 0;
  if (price <= 0) return null;

  const beds = raw.bedrooms ?? raw.property?.bedrooms ?? 0;
  const bathsFull = raw.bathsFull ?? raw.property?.bathsFull ?? 0;
  const bathsHalf = raw.bathsHalf ?? raw.property?.bathsHalf ?? 0;
  const baths = bathsFull + bathsHalf * 0.5;
  const sqft = raw.property?.area ?? 0;

  const rawType = (raw.property?.type ?? "").toUpperCase();
  const rawSubType = (raw.property?.subType ?? raw.property?.subTypeText ?? "").toUpperCase();
  const isCondo = rawType === "CON" || rawType === "CONDOMINIUM"
    || rawSubType.includes("CONDO") || rawSubType.includes("TOWN");
  const type: "House" | "Condo" = isCondo ? "Condo" : "House";

  const address = raw.address?.full
    ?? [raw.address?.streetNumber, raw.address?.streetName].filter(Boolean).join(" ")
    ?? "Address unavailable";
  const city = raw.address?.city ?? "";
  const monthly = estimateMonthlyCost(price);
  const id = typeof raw.mlsId === "number" ? raw.mlsId : index + 1;

  return {
    id,
    city,
    address,
    price,
    beds,
    baths,
    sqft,
    monthly,
    fit: fitFor(monthly),
    color: colorForIndex(index),
    type,
    photo: raw.photos?.[0],
    externalUrl: raw.virtualTourUrl
  };
}

// Re-export so callers can also filter locally when they already have a list.
export { ANY_HOME_TYPE, matchListings };
