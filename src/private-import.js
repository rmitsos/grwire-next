import { createHash, timingSafeEqual } from "node:crypto";
import { createSourceAdapter } from "./sources/index.js";

export class PrivateImportWorkflow {
  constructor({ secret, store, fetch, now = () => new Date() }) {
    if (!secret) throw new TypeError("An import secret is required");
    if (!store?.upsertItems) throw new TypeError("A store with upsertItems is required");
    this.secret = secret; this.store = store; this.fetch = fetch; this.now = now;
  }

  async run(request) {
    if (!secureEqual(request?.token, this.secret)) throw new Error("Unauthorized import");
    const source = sanitizeSource(request.source);
    const adapter = createSourceAdapter(source.type, { fetch: this.fetch });
    const loaded = await adapter.load(source);
    const unique = [...new Map(loaded.map((item) => [canonicalUrl(item.url), item])).values()];
    const result = await this.store.upsertItems(unique, { source, importedAt: this.now().toISOString() });
    return { source: source.url, fetched: loaded.length, imported: result?.imported ?? unique.length, skipped: loaded.length - unique.length };
  }
}

function secureEqual(value, secret) {
  if (typeof value !== "string") return false;
  const a = createHash("sha256").update(value).digest();
  const b = createHash("sha256").update(secret).digest();
  return timingSafeEqual(a, b);
}
function canonicalUrl(value) { const url = new URL(value); url.hash = ""; return url.href; }
function sanitizeSource(source) {
    if (!source || !["rss", "atom", "sitemap", "html", "wordpress", "gdelt"].includes(source.type)) throw new TypeError("A supported source type is required");
  const url = new URL(source.url);
  if (!/^https?:$/.test(url.protocol)) throw new TypeError("Source URL must use HTTP(S)");
  return {
    ...source,
    type: source.type,
    url: url.href,
    headers: source.headers,
    linkClass: source.linkClass,
  };
}
