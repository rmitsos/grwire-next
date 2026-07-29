import { neon } from "@neondatabase/serverless";
import { tracePossibleImpacts } from "./impact-map";
import { validateRelationship } from "./relationships";

export async function getDashboardData() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) return previewData();

  const sql = neon(connectionString);
  try {
    const [articleRows, organizationRows, claimRows, evidenceRows] = await Promise.all([
      sql`SELECT id, canonical_url, title, summary, published_at, source_id, score
          FROM articles ORDER BY published_at DESC NULLS LAST LIMIT 30`,
      sql`SELECT id, name, aliases, sector FROM organizations ORDER BY name`,
      sql`SELECT * FROM relationship_claims
          WHERE claim_status <> 'expired'
          ORDER BY confidence DESC, reviewed_at DESC NULLS LAST`,
      sql`SELECT * FROM relationship_evidence ORDER BY observed_at DESC`,
    ]);

    const evidenceByClaim = groupEvidence(evidenceRows);
    const relationships = claimRows.map((row) => ({
      id: row.id,
      sourceOrganizationId: row.source_organization_id,
      targetOrganizationId: row.target_organization_id,
      type: row.relationship_type,
      status: row.claim_status,
      confidence: Number(row.confidence),
      direction: row.direction,
      visibility: row.visibility,
      validFrom: iso(row.valid_from),
      validTo: iso(row.valid_to),
      impact: row.impact,
      rationale: row.rationale,
      reviewedAt: iso(row.reviewed_at),
      evidence: (evidenceByClaim.get(row.id) || []).map((evidence) => ({
        kind: evidence.kind,
        url: evidence.url,
        articleId: evidence.article_id,
        observedAt: iso(evidence.observed_at),
        quote: evidence.quote,
        note: evidence.note,
        sourceId: evidence.source_id,
        author: evidence.author,
        visibility: evidence.visibility,
      })),
    }));

    return {
      preview: false,
      articles: articleRows.map((row) => ({
        id: row.id,
        url: row.canonical_url,
        title: row.title,
        summary: row.summary,
        publishedAt: iso(row.published_at),
        sourceId: row.source_id,
        score: Number(row.score),
      })),
      organizations: organizationRows,
      relationships,
      impacts: buildImpactSummary(organizationRows, relationships),
    };
  } catch (error) {
    console.error("[dashboard] database read failed:", error?.message || error);
    return { ...previewData(), databaseError: true };
  }
}

function buildImpactSummary(organizations, relationships) {
  return organizations
    .flatMap((organization) =>
      tracePossibleImpacts({
        organizationId: organization.id,
        relationships,
        maxDepth: 3,
        minimumConfidence: 0.3,
      }).slice(0, 3),
    )
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 12);
}

function previewData() {
  const organizations = [
    { id: "example-regulator", name: "Example Regulator", aliases: [], sector: "Regulation" },
    { id: "example-operator", name: "Example Network Operator", aliases: [], sector: "Telecom" },
    { id: "example-supplier", name: "Example Infrastructure Supplier", aliases: [], sector: "Infrastructure" },
  ];
  const evidence = [{
    kind: "professional_note",
    note: "Fictional preview note — replace with private market knowledge.",
    observedAt: "2026-07-29T00:00:00.000Z",
    author: "Preview",
    visibility: "private",
  }];
  const relationships = [
    validateRelationship({
      id: "preview-1",
      sourceOrganizationId: "example-regulator",
      targetOrganizationId: "example-operator",
      type: "regulated_by",
      status: "confirmed",
      confidence: 0.95,
      visibility: "private",
      impact: { areas: ["regulatory", "capex"], polarity: "uncertain", magnitude: "high", lag: "6-18 months" },
      evidence,
    }),
    validateRelationship({
      id: "preview-2",
      sourceOrganizationId: "example-operator",
      targetOrganizationId: "example-supplier",
      type: "customer_of",
      status: "assessment",
      confidence: 0.65,
      visibility: "private",
      impact: { areas: ["revenue", "delivery"], polarity: "mixed", magnitude: "medium", lag: "3-12 months" },
      evidence,
    }),
  ];
  return {
    preview: true,
    articles: [{
      id: "preview-article",
      title: "Fictional preview: regulator announces infrastructure programme",
      summary: "Demonstrates how relevant news will connect to the private organisation map.",
      url: "#",
      sourceId: "Preview",
      publishedAt: "2026-07-29T12:00:00.000Z",
      score: 10,
    }],
    organizations,
    relationships,
    impacts: buildImpactSummary(organizations, relationships),
  };
}

function iso(value) {
  return value ? new Date(value).toISOString() : undefined;
}

function groupEvidence(rows) {
  const grouped = new Map();
  for (const row of rows) {
    const items = grouped.get(row.relationship_id) || [];
    items.push(row);
    grouped.set(row.relationship_id, items);
  }
  return grouped;
}
