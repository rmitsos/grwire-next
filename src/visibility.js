const PUBLIC_STATUSES = new Set(["confirmed", "reported"]);

export function canPublishRelationship(relationship) {
  return relationship.visibility === "public"
    && PUBLIC_STATUSES.has(relationship.status)
    && relationship.evidence?.some(isPublicEvidence);
}

export function publicRelationship(relationship) {
  if (!canPublishRelationship(relationship)) return null;
  return {
    id: relationship.id,
    sourceOrganizationId: relationship.sourceOrganizationId,
    targetOrganizationId: relationship.targetOrganizationId,
    type: relationship.type,
    status: relationship.status,
    confidence: relationship.confidence,
    direction: relationship.direction,
    validFrom: relationship.validFrom,
    validTo: relationship.validTo,
    impact: relationship.impact,
    reviewedAt: relationship.reviewedAt,
    evidence: relationship.evidence.filter(isPublicEvidence).map((evidence) => ({
      kind: evidence.kind,
      url: evidence.url,
      articleId: evidence.articleId,
      observedAt: evidence.observedAt,
      quote: evidence.quote,
      sourceId: evidence.sourceId,
    })),
  };
}

export function filterRelationshipsForAudience(relationships, audience = "private") {
  if (audience === "private") return relationships;
  return relationships.map(publicRelationship).filter(Boolean);
}

function isPublicEvidence(evidence) {
  return evidence.visibility === "public"
    && evidence.kind !== "professional_note"
    && Boolean(evidence.url);
}
