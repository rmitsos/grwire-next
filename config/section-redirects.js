/**
 * Permanent redirects from sources-spec.md §1 section ids to the existing
 * public slug each one maps onto (see the `specId` field on each
 * PUBLIC_CATEGORIES entry in src/public-data.js). No new sections exist yet
 * for the spec's tenders-contracts or regulators-policy ids, so /tenders and
 * /regulators are intentionally absent here (Phase 2).
 */
export const SECTION_REDIRECTS = [
  { source: "/telecom-fibre", destination: "/telco", permanent: true },
  { source: "/energy-grids", destination: "/energy", permanent: true },
  { source: "/infrastructure-works", destination: "/infrastructure", permanent: true },
  { source: "/deals-companies", destination: "/finance", permanent: true },
];
