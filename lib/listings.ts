/**
 * Shared mock listing data and matching logic, used by both the search UI
 * (client-side) and the daily saved-search alert cron job (server-side) so
 * the two never drift apart. Swap this out once a real MCP/MLS listing
 * provider is connected.
 */

export type Listing = {
  id: number;
  city: string;
  address: string;
  price: number;
  beds: number;
  baths: number;
  sqft: number;
  monthly: number;
  fit: "Comfortable" | "Stretch" | "Over capacity";
  color: string;
  type: "House" | "Condo";
};

export const listings: Listing[] = [
  { id: 1, city: "Sacramento", address: "1842 Maple Grove Lane", price: 589000, beds: 3, baths: 2, sqft: 1720, monthly: 3880, fit: "Comfortable", color: "coral", type: "House" },
  { id: 2, city: "Roseville", address: "940 Juniper Ridge Drive", price: 685000, beds: 4, baths: 3, sqft: 2240, monthly: 4470, fit: "Stretch", color: "blue", type: "House" },
  { id: 3, city: "Elk Grove", address: "2717 Willow Bend Court", price: 615000, beds: 3, baths: 2.5, sqft: 1950, monthly: 4090, fit: "Comfortable", color: "green", type: "House" },
  { id: 4, city: "Folsom", address: "1087 Granite Creek Way", price: 749000, beds: 4, baths: 3, sqft: 2460, monthly: 4860, fit: "Over capacity", color: "gold", type: "House" },
  { id: 5, city: "Sacramento", address: "410 Cedar Court, Unit 3", price: 429000, beds: 2, baths: 2, sqft: 1120, monthly: 2960, fit: "Comfortable", color: "green", type: "Condo" },
  { id: 6, city: "Folsom", address: "2255 Vista Ridge Terrace", price: 1050000, beds: 5, baths: 4, sqft: 3380, monthly: 6970, fit: "Over capacity", color: "blue", type: "House" }
];

export const ANY_HOME_TYPE = "Any home";

export type SearchCriteria = {
  query: string;
  maxPrice: number;
  homeType: string;
};

export function matchListings(criteria: SearchCriteria): Listing[] {
  const search = criteria.query.toLowerCase().trim();
  return listings.filter((listing) => {
    return (
      listing.price <= criteria.maxPrice &&
      (criteria.homeType === ANY_HOME_TYPE || listing.type === criteria.homeType) &&
      (!search || `${listing.address} ${listing.city}`.toLowerCase().includes(search))
    );
  });
}
