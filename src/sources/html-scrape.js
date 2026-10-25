import { absoluteUrl, fetchText, stripTags } from "./utils.js";

/**
 * Generic "monthly listing page" html-scrape adapter (sources-spec.md §2.2
 * ppc-press is the only source using this today). A source config has:
 *   urlTemplate   - e.g. ".../deltia-tipou-{yyyy}/{month_el_latin}-{yyyy}/"
 *   monthElLatin  - { 10: "oktovrios", ... } map of known month slugs
 *   linkPattern   - RegExp source tested against the resolved pathname
 *   dateRegex     - RegExp source with (dd, mm, yyyy) capture groups
 * Every run fetches both the current and the previous Europe/Athens month,
 * each only if its slug is known; an unknown month yields no URL for that
 * month rather than throwing. Each month is fetched with redirect: "manual",
 * and any response that isn't a plain 200 (redirect, 4xx/5xx, or a network
 * error) is skipped silently for that month only — the source still
 * succeeds with whatever the other month returned.
 */
export class HtmlScrapeSourceAdapter {
  constructor(options = {}) { this.fetch = options.fetch || globalThis.fetch; }

  async load(source, { now = Date.now() } = {}) {
    const urls = buildMonthUrls(source, now);
    if (!urls.length) {
      console.warn(`[html-scrape] ${source.id || source.url}: no known month slug for the current (or previous) Europe/Athens month`);
      return [];
    }
    const pages = await Promise.all(urls.map(async (url) => {
      try {
        const result = await fetchText(this.fetch, url, {
          headers: source.headers,
          timeoutMs: source.timeoutMs,
          maxBytes: source.maxBytes,
          accept: "text/html, application/xhtml+xml",
          redirect: "manual",
        });
        return this.parse(result.text, result.url, source);
      } catch {
        // A redirect, 4xx/5xx or network error for one month must not fail
        // the whole source (sources-spec.md §2.2 ppc-press note).
        return [];
      }
    }));
    const unique = new Map();
    for (const item of pages.flat()) {
      const previous = unique.get(item.url);
      if (!previous || item.title.length > previous.title.length) unique.set(item.url, item);
    }
    return [...unique.values()];
  }

  parse(html, sourceUrl, source = {}) {
    const linkPattern = new RegExp(source.linkPattern);
    const dateRegex = new RegExp(source.dateRegex);
    const anchors = [...html.matchAll(/<a\b([^>]*)href=["']([^"']+)["']([^>]*)>([\s\S]*?)<\/a>/gi)];
    return anchors.flatMap(([, , href, , contents]) => {
      const url = absoluteUrl(href, sourceUrl);
      if (!url) return [];
      let pathname;
      try { pathname = new URL(url).pathname; } catch { return []; }
      if (!linkPattern.test(pathname)) return [];

      const dateMatch = contents.match(dateRegex);
      const publishedAt = dateMatch ? athensDateToIso(dateMatch[1], dateMatch[2], dateMatch[3]) : undefined;

      // The date is rendered as its own element inside the same anchor (a
      // "category" badge next to the headline); it is not part of the title.
      let title = stripTags(contents);
      if (dateMatch) title = title.replace(dateMatch[0], " ").replace(/\s+/g, " ").trim();
      if (!title) return [];

      return [{ id: url, url, title, summary: undefined, publishedAt, sourceUrl, metadata: {} }];
    });
  }
}

/** Europe/Athens {year, month, day} for a given instant. */
export function athensDateParts(now = Date.now()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Athens",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(now));
  const get = (type) => Number(parts.find((part) => part.type === type)?.value);
  return { year: get("year"), month: get("month"), day: get("day") };
}

// Builds the URL(s) to poll for the current Europe/Athens month and the
// previous one, every run (sources-spec.md §2.2 ppc-press note). A month
// with no known slug in `source.monthElLatin` is silently skipped.
export function buildMonthUrls(source, now = Date.now()) {
  const { year, month } = athensDateParts(now);
  const previous = month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
  const months = [previous, { year, month }];
  const urls = [];
  for (const { year: y, month: m } of months) {
    const slug = source.monthElLatin?.[m];
    if (!slug) continue;
    urls.push(source.urlTemplate.replaceAll("{yyyy}", String(y)).replaceAll("{month_el_latin}", slug));
  }
  return urls;
}

// Interprets a dd.mm.yyyy date as Europe/Athens midnight and returns it as
// an ISO instant, accounting for EET/EEST without a timezone-database
// dependency (Intl already knows the Europe/Athens offset).
function athensDateToIso(dd, mm, yyyy) {
  const year = Number(yyyy);
  const month = Number(mm);
  const day = Number(dd);
  const guessUtcNoon = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  const offsetPart = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Athens", timeZoneName: "shortOffset" })
    .formatToParts(guessUtcNoon)
    .find((part) => part.type === "timeZoneName")?.value || "GMT+2";
  const offsetHours = Number(offsetPart.match(/GMT([+-]\d+)/)?.[1] ?? 2);
  const sign = offsetHours >= 0 ? "+" : "-";
  const offset = `${sign}${String(Math.abs(offsetHours)).padStart(2, "0")}:00`;
  const iso = new Date(`${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T00:00:00${offset}`);
  return Number.isNaN(iso.getTime()) ? undefined : iso.toISOString();
}
