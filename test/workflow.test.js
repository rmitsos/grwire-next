import test from "node:test";
import assert from "node:assert/strict";
import { PrivateImportWorkflow, validateRelationship } from "../src/index.js";

test("relationships require attributable evidence", () => {
  assert.throws(() => validateRelationship({ sourceOrganizationId: "a", targetOrganizationId: "b", type: "owns", evidence: [] }));
  const value = validateRelationship({ sourceOrganizationId: "a", targetOrganizationId: "b", type: "owns", confidence: .9, evidence: [{ url: "https://x.test/report", observedAt: "2025-01-01", quote: " A owns B. " }] });
  assert.equal(value.evidence[0].quote, "A owns B."); assert.equal(value.confidence, .9);
});

test("private workflow authenticates, deduplicates and persists", async () => {
  let saved;
  const fetch = async () => ({ ok: true, url: "https://x.test/feed", text: async () => `<rss><channel><item><link>https://x.test/a#one</link></item><item><link>https://x.test/a#two</link></item></channel></rss>` });
  const workflow = new PrivateImportWorkflow({ secret: "secret", fetch, store: { upsertItems: async (items) => { saved = items; return { imported: items.length }; } } });
  await assert.rejects(() => workflow.run({ token: "wrong", source: { type: "rss", url: "https://x.test/feed" } }), /Unauthorized/);
  const result = await workflow.run({ token: "secret", source: { type: "rss", url: "https://x.test/feed" } });
  assert.equal(saved.length, 1); assert.deepEqual(result, { source: "https://x.test/feed", fetched: 2, imported: 1, skipped: 1 });
});
