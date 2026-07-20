# HomeBuy Agent

A public, open-source web app that combines authorized real-estate listing tools with a buyer's lender limits and personal cash-flow rules.

## What works in this starter

- Zillow/Redfin-style search filters.
- Provider-neutral remote MCP listing integration.
- Demonstration listings for local development.
- Mortgage, property tax, insurance, PMI, HOA, cash-to-close, reserve, and DTI calculations.
- Ranking into `comfortable`, `stretch`, and `over_capacity`.
- PDF pre-approval extraction through the OpenAI Responses API.
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

## Deploy to Vercel

1. Create a public GitHub repository.
2. Push this project.
3. Import the repository into Vercel.
4. Add environment variables in Vercel; never commit them.
5. Deploy.

## Recommended roadmap

- Phase 1: Saved filters, manual pre-approval fields, authorized listing search, affordability ranking.
- Phase 2: Authentication, encrypted profile storage, alerts, saved properties, disclosure uploads.
- Phase 3: Disclosure risk extraction, comparable sales, offer scenarios, lender quote comparison.
- Phase 4: Human-approved agent workflows for contacting agents and producing offer packets.

## Disclaimer

This project produces estimates for research and planning. It is not a lending commitment, appraisal, legal advice, tax advice, or real-estate brokerage service.
