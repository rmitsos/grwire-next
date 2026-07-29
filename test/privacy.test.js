import test from "node:test";
import assert from "node:assert/strict";
import {
  filterRelationshipsForAudience,
  publicRelationship,
  validateRelationship,
} from "../src/index.js";

const publicEvidence = {
  kind: "article",
  url: "https://registry.test/filing",
  observedAt: "2026-07-29",
  visibility: "public",
  quote: "A owns B",
};

test("private professional knowledge never enters public output", () => {
  const relationship = validateRelationship({
    sourceOrganizationId: "a",
    targetOrganizationId: "b",
    type: "partnered_with",
    status: "assessment",
    visibility: "private",
    evidence: [{
      kind: "professional_note",
      observedAt: "2026-07-29",
      note: "Sensitive commercial assessment",
      author: "Dimi",
    }],
  });
  assert.equal(publicRelationship(relationship), null);
  assert.deepEqual(filterRelationshipsForAudience([relationship], "public"), []);
});

test("only explicitly public confirmed or reported evidence is serialized", () => {
  const relationship = validateRelationship({
    sourceOrganizationId: "a",
    targetOrganizationId: "b",
    type: "owns",
    status: "confirmed",
    visibility: "public",
    evidence: [
      publicEvidence,
      {
        kind: "professional_note",
        observedAt: "2026-07-29",
        note: "Private context",
        visibility: "private",
      },
    ],
  });
  const output = publicRelationship(relationship);
  assert.equal(output.evidence.length, 1);
  assert.equal("note" in output.evidence[0], false);
  assert.doesNotMatch(JSON.stringify(output), /Private context/);
});

test("rumours cannot be published even when misconfigured as public", () => {
  const relationship = validateRelationship({
    sourceOrganizationId: "a",
    targetOrganizationId: "b",
    type: "partnered_with",
    status: "rumour",
    visibility: "public",
    evidence: [publicEvidence],
  });
  assert.equal(publicRelationship(relationship), null);
});
