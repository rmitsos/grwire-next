import { relationshipIsActive } from "./relationships.js";

/**
 * Finds possible exposure paths. These are hypotheses supported by the map,
 * never a statement that one event caused another.
 */
export function tracePossibleImpacts({
  organizationId,
  relationships,
  maxDepth = 3,
  minimumConfidence = 0.25,
  at = new Date(),
}) {
  const paths = [];
  const queue = [{ organizationId, path: [], confidence: 1 }];

  while (queue.length) {
    const current = queue.shift();
    if (current.path.length >= maxDepth) continue;

    for (const relationship of relationships) {
      if (!relationshipIsActive(relationship, at)) continue;
      const step = orientStep(current.organizationId, relationship);
      if (!step || current.path.some((item) => item.relationshipId === relationship.id)) continue;

      const confidence = current.confidence * relationship.confidence * depthPenalty(current.path.length);
      if (confidence < minimumConfidence) continue;
      const path = [
        ...current.path,
        {
          relationshipId: relationship.id,
          from: current.organizationId,
          to: step.to,
          type: relationship.type,
          reversed: step.reversed,
          status: relationship.status,
          impact: relationship.impact,
        },
      ];
      paths.push({
        origin: organizationId,
        target: step.to,
        confidence: Number(confidence.toFixed(3)),
        depth: path.length,
        path,
        explanation: explainPath(path),
      });
      queue.push({ organizationId: step.to, path, confidence });
    }
  }

  return paths.sort((a, b) => b.confidence - a.confidence || a.depth - b.depth);
}

export function attachArticlesToRelationships(articles, relationships) {
  const articleIds = new Set(articles.map((article) => article.id));
  return relationships.map((relationship) => ({
    ...relationship,
    relatedArticleIds: relationship.evidence
      .map((evidence) => evidence.articleId)
      .filter((id) => id && articleIds.has(id)),
  }));
}

function orientStep(id, relationship) {
  if (relationship.sourceOrganizationId === id) {
    return { to: relationship.targetOrganizationId, reversed: false };
  }
  const bidirectional = relationship.direction === "bidirectional"
    || ["partnered_with", "competes_with", "merged_with"].includes(relationship.type);
  if (bidirectional && relationship.targetOrganizationId === id) {
    return { to: relationship.sourceOrganizationId, reversed: true };
  }
  return null;
}

function depthPenalty(depth) {
  return depth === 0 ? 1 : 0.8;
}

function explainPath(path) {
  return path
    .map((step) => `${step.from} ${step.reversed ? "←" : "→"} ${step.type} ${step.reversed ? "←" : "→"} ${step.to}`)
    .join(" | ");
}
