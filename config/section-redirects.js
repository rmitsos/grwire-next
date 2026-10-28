/**
 * Permanent redirects, each mapping a sources-spec.md §1 section id or a
 * retired slug onto the current public slug (see the `specId` field on each
 * PUBLIC_CATEGORIES entry in src/public-data.js). No chains: every
 * destination here is a live slug, never another redirect's source.
 */
export const SECTION_REDIRECTS = [
  { source: "/telecom-fibre", destination: "/telco", permanent: true },
  { source: "/energy-grids", destination: "/energy", permanent: true },
  { source: "/infrastructure-works", destination: "/infrastructure", permanent: true },
  { source: "/tenders-contracts", destination: "/tenders", permanent: true },
  { source: "/regulators-policy", destination: "/regulators", permanent: true },
  { source: "/deals-companies", destination: "/deals", permanent: true },
  { source: "/finance", destination: "/deals", permanent: true },
];
