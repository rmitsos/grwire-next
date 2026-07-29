import { normalizeItem } from "./utils.js";

const ENDPOINT = "https://api.gdeltproject.org/api/v2/doc/doc";

/** Discovers matching coverage through GDELT's multilingual DOC API. */
export class GdeltSourceAdapter {
  constructor(options = {}) {
    this.fetch = options.fetch || globalThis.fetch;
  }

  async load(source) {
    if (!source.query?.trim()) throw new TypeError("GDELT source requires a query");
    const url = new URL(ENDPOINT);
    url.searchParams.set("query", source.query.trim());
    url.searchParams.set("mode", "artlist");
    url.searchParams.set("format", "json");
    url.searchParams.set("maxrecords", String(Math.min(source.limit || 50, 250)));
    url.searchParams.set("sort", source.sort || "datedesc");
    if (source.timespan) url.searchParams.set("timespan", source.timespan);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), source.timeoutMs || 12_000);
    try {
      const response = await this.fetch(url, {
        headers: { "User-Agent": "GRWire/0.2 (+https://grwire.com)", Accept: "application/json" },
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`GDELT request failed (${response.status})`);
      const body = await response.json();
      return (body.articles || []).flatMap((article) => {
        if (!article.url) return [];
        return [
          normalizeItem(
            {
              url: article.url,
              title: article.title,
              publishedAt: parseGdeltDate(article.seendate),
              metadata: {
                adapter: "gdelt",
                domain: article.domain,
                language: article.language,
                sourceCountry: article.sourcecountry,
              },
            },
            ENDPOINT,
          ),
        ];
      });
    } catch (error) {
      if (error?.name === "AbortError") throw new Error("GDELT request timed out");
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
}

function parseGdeltDate(value) {
  if (!value) return undefined;
  const match = String(value).match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
  return match
    ? `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}Z`
    : value;
}
