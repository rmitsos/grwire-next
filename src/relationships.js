export const RELATIONSHIP_TYPES = Object.freeze([
  "owns", "subsidiary_of", "invested_in", "partnered_with", "acquired", "merged_with", "formerly_known_as"
]);

export function validateRelationship(input) {
  if (!input || typeof input !== "object") throw new TypeError("Relationship must be an object");
  for (const field of ["sourceOrganizationId", "targetOrganizationId", "type"]) {
    if (!input[field] || typeof input[field] !== "string") throw new TypeError(`${field} is required`);
  }
  if (input.sourceOrganizationId === input.targetOrganizationId) throw new TypeError("A relationship cannot reference the same organization twice");
  if (!RELATIONSHIP_TYPES.includes(input.type)) throw new TypeError(`Unknown relationship type: ${input.type}`);
  if (!Array.isArray(input.evidence) || input.evidence.length === 0) throw new TypeError("At least one evidence record is required");
  const evidence = input.evidence.map((record) => {
    if (!record?.url || !record?.observedAt) throw new TypeError("Evidence requires url and observedAt");
    const url = new URL(record.url).href;
    const observedAt = new Date(record.observedAt);
    if (Number.isNaN(observedAt.valueOf())) throw new TypeError("Evidence observedAt must be a date");
    return { url, observedAt: observedAt.toISOString(), quote: record.quote?.trim() || undefined, sourceId: record.sourceId || undefined };
  });
  return {
    id: input.id || crypto.randomUUID(),
    sourceOrganizationId: input.sourceOrganizationId,
    targetOrganizationId: input.targetOrganizationId,
    type: input.type,
    status: input.status || "asserted",
    validFrom: input.validFrom || undefined,
    validTo: input.validTo || undefined,
    confidence: input.confidence ?? 0.5,
    evidence
  };
}
