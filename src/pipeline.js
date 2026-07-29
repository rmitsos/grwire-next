import { createSourceAdapter } from "./sources/index.js";
import { DEFAULT_WATCH_RULES, rankItems } from "./watch-rules.js";

export async function scanMarket({
  sources,
  rules = DEFAULT_WATCH_RULES,
  fetch,
  concurrency = 4,
}) {
  if (!Array.isArray(sources) || !sources.length) throw new TypeError("At least one source is required");
  const outcomes = [];

  for (let index = 0; index < sources.length; index += concurrency) {
    const batch = sources.slice(index, index + concurrency);
    const settled = await Promise.allSettled(
      batch.map(async (source) => {
        const adapter = createSourceAdapter(source.type, { fetch });
        return { source, items: await adapter.load(source) };
      }),
    );
    outcomes.push(...settled.map((result, offset) => ({ result, source: batch[offset] })));
  }

  const status = [];
  const byUrl = new Map();
  for (const { result, source } of outcomes) {
    if (result.status === "rejected") {
      status.push({ id: source.id || source.url, ok: false, error: result.reason?.message || String(result.reason) });
      continue;
    }
    status.push({ id: source.id || source.url, ok: true, fetched: result.value.items.length });
    for (const item of result.value.items) {
      const url = canonicalUrl(item.url);
      if (!byUrl.has(url)) byUrl.set(url, { ...item, sourceId: source.id || source.url });
    }
  }

  const ranked = rankItems([...byUrl.values()], rules);
  return {
    scannedAt: new Date().toISOString(),
    sources: status,
    fetched: [...byUrl.values()].length,
    relevant: ranked.length,
    items: ranked,
  };
}

function canonicalUrl(value) {
  const url = new URL(value);
  url.hash = "";
  for (const key of [...url.searchParams.keys()]) {
    if (/^(utm_|fbclid|gclid)/i.test(key)) url.searchParams.delete(key);
  }
  return url.href;
}
