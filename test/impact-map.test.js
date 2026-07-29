import test from "node:test";
import assert from "node:assert/strict";
import { tracePossibleImpacts, validateRelationship } from "../src/index.js";

const evidence = [{ note: "Professional market assessment", observedAt: "2026-07-29", author: "editor" }];

test("facts and rumours remain visibly distinct", () => {
  const confirmed = validateRelationship({
    sourceOrganizationId: "a",
    targetOrganizationId: "b",
    type: "owns",
    status: "confirmed",
    confidence: 0.98,
    evidence: [{ url: "https://registry.test/filing", observedAt: "2026-07-29" }],
  });
  const rumour = validateRelationship({
    sourceOrganizationId: "b",
    targetOrganizationId: "c",
    type: "partnered_with",
    status: "rumour",
    confidence: 0.4,
    evidence,
  });
  assert.equal(confirmed.status, "confirmed");
  assert.equal(rumour.status, "rumour");
  assert.throws(() => validateRelationship({ ...rumour, confidence: 0.9 }), /cannot exceed/);
});

test("impact tracing returns confidence-decayed paths, not causal claims", () => {
  const relationships = [
    validateRelationship({
      id: "r1",
      sourceOrganizationId: "regulator",
      targetOrganizationId: "operator",
      type: "regulated_by",
      status: "assessment",
      confidence: 0.7,
      evidence,
    }),
    validateRelationship({
      id: "r2",
      sourceOrganizationId: "operator",
      targetOrganizationId: "supplier",
      type: "supplies",
      status: "reported",
      confidence: 0.8,
      evidence,
    }),
  ];
  const paths = tracePossibleImpacts({ organizationId: "regulator", relationships });
  assert.equal(paths.some((path) => path.target === "supplier" && path.depth === 2), true);
  assert.ok(paths.find((path) => path.target === "supplier").confidence < 0.7);
});
