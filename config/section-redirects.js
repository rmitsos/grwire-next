/**
 * Permanent redirects. The first three map sources-spec.md §1 section ids to
 * the existing public slug each one maps onto (see the `specId` field on
 * each PUBLIC_CATEGORIES entry in src/public-data.js) — no new sections
 * exist yet for the spec's tenders-contracts or regulators-policy ids, so
 * /tenders and /regulators are intentionally absent here (Phase 2). The last
 * one is a legacy-slug redirect: /finance was retired in favour of
 * /deals-companies (its spec id and slug are now the same).
 */
export const SECTION_REDIRECTS = [
  { source: "/telecom-fibre", destination: "/telco", permanent: true },
  { source: "/energy-grids", destination: "/energy", permanent: true },
  { source: "/infrastructure-works", destination: "/infrastructure", permanent: true },
  { source: "/finance", destination: "/deals-companies", permanent: true },
];
