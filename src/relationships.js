export const RELATIONSHIP_TYPES = Object.freeze([
  "owns",
  "subsidiary_of",
  "invested_in",
  "partnered_with",
  "supplies",
  "customer_of",
  "competes_with",
  "regulated_by",
  "finances",
  "acquired",
  "merged_with",
  "formerly_known_as",
]);

export const CLAIM_STATUSES = Object.freeze([
  "confirmed",
  "reported",
  "assessment",
  "rumour",
  "disputed",
  "expired",
]);

export const IMPACT_AREAS = Object.freeze([
  "revenue",
  "margin",
  "capex",
  "financing",
  "regulatory",
  "delivery",
  "competition",
  "reputation",
  "valuation",
]);

const STATUS_CONFIDENCE_CEILING = Object.freeze({
  confirmed: 1,
  reported: 0.85,
  assessment: 0.75,
  rumour: 0.55,
  disputed: 0.5,
  expired: 1,
});

/**
 * A relationship is a claim, not an eternal truth. Status, evidence and
 * validity dates preserve what was known, by whom, and when.
 */
export function validateRelationship(input) {
  if (!input || typeof input !== "object") throw new TypeError("Relationship must be an object");
  for (const field of ["sourceOrganizationId", "targetOrganizationId", "type"]) {
    if (!input[field] || typeof input[field] !== "string") throw new TypeError(`${field} is required`);
  }
  if (input.sourceOrganizationId === input.targetOrganizationId) {
    throw new TypeError("A relationship cannot reference the same organization twice");
  }
  if (!RELATIONSHIP_TYPES.includes(input.type)) {
    throw new TypeError(`Unknown relationship type: ${input.type}`);
  }

  // Legacy records did not have a status. Treat them as confirmed rather
  // than silently downgrading or rejecting previously accepted knowledge.
  const status = input.status || "confirmed";
  if (!CLAIM_STATUSES.includes(status)) throw new TypeError(`Unknown claim status: ${status}`);
  if (!Array.isArray(input.evidence) || input.evidence.length === 0) {
    throw new TypeError("At least one evidence record is required");
  }

  const confidence = input.confidence ?? defaultConfidence(status);
  if (typeof confidence !== "number" || confidence < 0 || confidence > 1) {
    throw new TypeError("Confidence must be between 0 and 1");
  }
  if (confidence > STATUS_CONFIDENCE_CEILING[status]) {
    throw new TypeError(`${status} confidence cannot exceed ${STATUS_CONFIDENCE_CEILING[status]}`);
  }

  const validFrom = optionalDate(input.validFrom, "validFrom");
  const validTo = optionalDate(input.validTo, "validTo");
  if (validFrom && validTo && validFrom > validTo) {
    throw new TypeError("validFrom must be before validTo");
  }

  const impact = validateImpact(input.impact);
  const evidence = input.evidence.map(validateEvidence);
  return {
    id: input.id || crypto.randomUUID(),
    sourceOrganizationId: input.sourceOrganizationId,
    targetOrganizationId: input.targetOrganizationId,
    type: input.type,
    status,
    confidence,
    direction: input.direction || "directed",
    visibility: input.visibility || "private",
    validFrom,
    validTo,
    impact,
    rationale: input.rationale?.trim() || undefined,
    evidence,
    createdAt: optionalDate(input.createdAt, "createdAt") || new Date().toISOString(),
    reviewedAt: optionalDate(input.reviewedAt, "reviewedAt"),
  };
}

function validateEvidence(record) {
  if (!record?.observedAt) throw new TypeError("Evidence requires observedAt");
  if (!record.url && !record.note) throw new TypeError("Evidence requires a URL or private note");
  const observedAt = optionalDate(record.observedAt, "evidence observedAt");
  return {
    kind: record.kind || (record.url ? "article" : "professional_note"),
    url: record.url ? new URL(record.url).href : undefined,
    articleId: record.articleId || undefined,
    observedAt,
    quote: record.quote?.trim() || undefined,
    note: record.note?.trim() || undefined,
    sourceId: record.sourceId || undefined,
    author: record.author?.trim() || undefined,
    visibility: record.visibility || "private",
  };
}

function validateImpact(value) {
  if (!value) return undefined;
  const areas = value.areas || [];
  for (const area of areas) {
    if (!IMPACT_AREAS.includes(area)) throw new TypeError(`Unknown impact area: ${area}`);
  }
  const polarity = value.polarity || "uncertain";
  if (!["positive", "negative", "mixed", "uncertain"].includes(polarity)) {
    throw new TypeError(`Unknown impact polarity: ${polarity}`);
  }
  return {
    areas,
    polarity,
    magnitude: value.magnitude || "unknown",
    lag: value.lag || "unknown",
    explanation: value.explanation?.trim() || undefined,
  };
}

function optionalDate(value, label) {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) throw new TypeError(`${label} must be a date`);
  return date.toISOString();
}

function defaultConfidence(status) {
  return {
    confirmed: 0.95,
    reported: 0.7,
    assessment: 0.6,
    rumour: 0.35,
    disputed: 0.3,
    expired: 0.9,
  }[status];
}

export function relationshipIsActive(relationship, at = new Date()) {
  if (relationship.status === "expired") return false;
  const stamp = at.valueOf();
  return (!relationship.validFrom || Date.parse(relationship.validFrom) <= stamp)
    && (!relationship.validTo || Date.parse(relationship.validTo) >= stamp);
}
