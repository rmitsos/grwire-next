# GR Wire Next

A focused Greek market-intelligence engine for finance, telecom and energy
infrastructure. It discovers coverage through multiple channels, scores it
against explicit watch rules, and connects articles to a time-aware map of
organisations and market relationships.

## Why this version

RSS remains useful, but it is not the architecture. Sources can be:

- RSS or Atom feeds
- WordPress public JSON APIs
- XML and news sitemaps
- HTML press-release listings
- GDELT multilingual news discovery

Every adapter produces the same item shape. A bounded market scanner isolates
source failures, strips tracking parameters, deduplicates URLs and ranks only
the stories that pass a named rule.

## Relationship intelligence

The relationship map preserves professional knowledge without presenting every
claim as fact. Each relationship carries:

- source and target organisation
- relationship type and direction
- `confirmed`, `reported`, `assessment`, `rumour`, `disputed` or `expired`
  status
- confidence and effective dates
- public article evidence or a private professional note
- possible impact area, polarity, magnitude and lag

Rumour confidence is deliberately capped. Possible impact paths lose confidence
at every hop and are described as exposure hypotheses, never as proof of
causation.

## Run

Requires Node.js 20 or later.

```bash
npm test
npm run check
npm run scan
```

`npm run scan` prints a review-ready JSON report. The initial source registry is
in `config/sources.js`; the default market rules are in `src/watch-rules.js`.

## Example

```js
import {
  scanMarket,
  tracePossibleImpacts,
  validateRelationship,
} from "grwire-next";

const report = await scanMarket({
  sources: [
    {
      id: "publisher-api",
      type: "wordpress",
      url: "https://publisher.example",
      search: "FTTH",
    },
    {
      id: "market-discovery",
      type: "gdelt",
      url: "https://api.gdeltproject.org/api/v2/doc/doc",
      query: '(OTE OR Cosmote) (FTTH OR fiber OR 5G)',
      timespan: "3days",
    },
  ],
});

const relationship = validateRelationship({
  sourceOrganizationId: "operator",
  targetOrganizationId: "supplier",
  type: "customer_of",
  status: "assessment",
  confidence: 0.65,
  visibility: "private",
  impact: {
    areas: ["revenue", "delivery"],
    polarity: "uncertain",
    magnitude: "medium",
    lag: "3-12 months",
  },
  evidence: [{
    kind: "professional_note",
    observedAt: "2026-07-29",
    note: "Commercial assessment based on market experience.",
  }],
});

const paths = tracePossibleImpacts({
  organizationId: "operator",
  relationships: [relationship],
});
```

## Current scope

Version 0.2 is the ingestion and relationship-intelligence foundation. It has
PostgreSQL/Neon persistence is defined in `db/schema.sql`, including private
knowledge tables and restricted public views. The application store accepts a
node-postgres-compatible client and automatically links articles to known
organisations. The next step is the authenticated private review dashboard.
