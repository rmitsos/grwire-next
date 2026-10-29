import { isCuratedAuthorised, storeCuratedItems, validateCuratedBatch, CURATED_MAX_BODY_BYTES } from "./curated.js";

const json = (body, status = 200) => Response.json(body, { status, headers: { "cache-control": "no-store" } });

/**
 * POST /api/curated. Dependencies are injected so the route stays thin and tests need no Next.js:
 *   env        process.env-like, read for CURATED_INGEST_SECRET only
 *   getSql     () => Promise<neon sql> (ensureDatabase: applies the additive schema, then returns the client)
 *   revalidate () => void, rebuilds the cached public pages
 */
export async function handleCuratedRequest(request, { env, getSql, revalidate = () => {}, now = Date.now() }) {
  // Auth first, before the body is read or the database is touched. 401 for a missing env var too.
  if (!isCuratedAuthorised(request.headers.get("authorization"), env.CURATED_INGEST_SECRET)) {
    return json({ ok: false, error: "Unauthorized" }, 401);
  }

  const declared = Number(request.headers.get("content-length") || 0);
  if (declared > CURATED_MAX_BODY_BYTES) return json({ ok: false, error: "Body too large" }, 413);
  const text = await request.text();
  if (Buffer.byteLength(text) > CURATED_MAX_BODY_BYTES) return json({ ok: false, error: "Body too large" }, 413);
  let body;
  try { body = JSON.parse(text); } catch { return json({ ok: false, error: "Body is not valid JSON" }, 400); }

  const batch = validateCuratedBatch(body, { now });
  if (batch.error) return json({ ok: false, error: batch.error }, 400);

  let stored = { inserted: 0, duplicates: 0 };
  if (batch.items.length) {
    try {
      const sql = await getSql();
      stored = await storeCuratedItems(sql, batch.items);
    } catch (error) {
      console.error("[curated] store failed:", error?.name || "Error", error?.code || "");
      return json({ ok: false, error: "Could not store items" }, 500);
    }
    if (stored.inserted) revalidate();
  }
  return json({
    ok: true,
    inserted: stored.inserted,
    duplicates: stored.duplicates + batch.duplicates,
    rejected: batch.rejected,
  });
}
