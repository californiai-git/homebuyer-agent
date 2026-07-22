import { Resend } from "resend";
import type { Listing } from "./listings";

const apiKey = process.env.RESEND_API_KEY;
const fromAddress = process.env.RESEND_FROM_EMAIL ?? "HomeBuy Agent <onboarding@resend.dev>";

if (!apiKey) {
  console.warn("RESEND_API_KEY is not set; daily saved-search alert emails are disabled.");
}

const resend = apiKey ? new Resend(apiKey) : null;

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

/** Sends a "new matches" digest email for one saved search. No-ops if Resend isn't configured. */
export async function sendNewMatchesEmail(params: {
  to: string;
  savedSearchName: string;
  matches: Listing[];
}): Promise<void> {
  if (!resend) {
    console.warn(`Skipping alert email to ${params.to}: RESEND_API_KEY is not set.`);
    return;
  }

  const count = params.matches.length;
  const listItems = params.matches
    .map((listing) => `<li>${listing.address}, ${listing.city} \u2014 ${money.format(listing.price)}</li>`)
    .join("");

  await resend.emails.send({
    from: fromAddress,
    to: params.to,
    subject: `${count} new match${count === 1 ? "" : "es"} for "${params.savedSearchName}"`,
    html: `<p>New homes matching your saved search <strong>${params.savedSearchName}</strong>:</p><ul>${listItems}</ul>`
  });
}
