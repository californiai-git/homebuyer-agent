# HomeBuy Agent

A public, open-source web app that combines authorized real-estate listing tools with a buyer's lender limits and personal cash-flow rules.

## What works in this starter

- Zillow/Redfin-style search filters.
- Provider-neutral remote MCP listing integration.
- Demonstration listings for local development.
- Mortgage, property tax, insurance, PMI, HOA, cash-to-close, reserve, and DTI calculations.
- Ranking into `comfortable`, `stretch`, and `over_capacity`.
- PDF pre-approval extraction through the OpenAI Responses API.
- Sign in with Google, and store sensitive documents in the user's own Google Drive.
- Responsive Next.js UI, tests, and GitHub Actions CI.

## Important data-source rule

Do not scrape Zillow or Redfin. Use only a licensed/approved API, MLS feed, brokerage feed, or MCP server whose terms permit your application. Redfin's terms prohibit automated crawling/scraping without written permission. Zillow listing access is approval-based and can impose display, retention, and bulk-access restrictions.

## Local setup

```bash
cp .env.example .env.local
npm install
npm run dev
```

Open `http://localhost:3000`.

The app uses demonstration listings until both `OPENAI_API_KEY` and `MCP_LISTINGS_SERVER_URL` are configured and `USE_MOCK_LISTINGS` is not `true`.

## MCP integration

Set:

```bash
MCP_LISTINGS_SERVER_URL=https://your-authorized-server.example/mcp
MCP_LISTINGS_SERVER_LABEL=listings
MCP_LISTINGS_AUTHORIZATION=Bearer_your_token
USE_MOCK_LISTINGS=false
```

The server should expose tools capable of searching active listings and returning property details. The agent normalizes results into the schema in `lib/types.ts`.

## Google sign-in and Drive-backed document storage

Sign-in uses Google only (no other providers), and the same Google OAuth token is used to store each user's sensitive documents in *their own* Google Drive - never on this app's servers.

1. In the [Google Cloud Console](https://console.cloud.google.com/apis/credentials), create an OAuth 2.0 Client ID (type: Web application).
2. Add authorized redirect URI `http://localhost:3000/api/auth/callback/google` for local development, plus your production URL equivalent.
3. Enable the **Google Drive API** for the project.
4. On the OAuth consent screen, add the `https://www.googleapis.com/auth/drive.file` scope. This scope only grants access to files and folders the app itself creates - it deliberately avoids the broader `drive` scope, which requires a costly annual third-party security assessment for Google API verification.
5. Set the following in `.env.local`:

   ```bash
   AUTH_GOOGLE_ID=your-client-id
   AUTH_GOOGLE_SECRET=your-client-secret
   AUTH_SECRET=$(npx auth secret)
   AUTH_URL=http://localhost:3000
   ```

Once signed in, the app creates this structure in the user's own Drive on demand:

```text
homebuyer-agent/
  common/                        Preapprovals, bank statements, income documents
  1842 Maple Grove Lane, ...      Disclosures, inspections, offers for that house
  940 Juniper Ridge Drive, ...     (one folder per house address)
```

Tenant isolation for documents comes from Google's own OAuth access control (each user's token only ever sees their own Drive), rather than from a shared database, so there is no cross-user document store to misconfigure.

Signing in and document storage require a Node.js server (Vercel or self-hosted) and are not available on the static GitHub Pages preview.

## Deploy to Vercel

1. Create a public GitHub repository.
2. Push this project.
3. Import the repository into Vercel.
4. Add environment variables in Vercel; never commit them.
5. Deploy.

## Recommended roadmap

- Phase 1: Saved filters, manual pre-approval fields, authorized listing search, affordability ranking.
- Phase 2: Google sign-in (done), Google Drive-backed document storage (done), alerts, saved properties.
- Phase 3: Disclosure risk extraction, comparable sales, offer scenarios, lender quote comparison.
- Phase 4: Human-approved agent workflows for contacting agents and producing offer packets.

## Disclaimer

This project produces estimates for research and planning. It is not a lending commitment, appraisal, legal advice, tax advice, or real-estate brokerage service.
