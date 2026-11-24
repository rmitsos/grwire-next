import { normalizeItem } from "./utils.js";
import { matchesAnyTerm } from "../feed-rules.js";

const DEFAULT_TED_URL = "https://api.ted.europa.eu/v3/notices/search";
const DEFAULT_CPV_PREFIXES = [
  // Telecoms, networking, optical & radio equipment
  "642", "324", "325",
  // Electricity, grids, substations, transformers, cables & renewables
  "093", "311", "312", "313",
  // Infrastructure: pipelines, telecom/power lines, railways, motorways, tunnels, ports
  "4523",
];

function formatDateYmd(date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Athens" })
    .format(date)
    .replaceAll("-", "");
}

function pickLocalized(value, preferred = ["ell", "eng"]) {
  if (!value) return "";
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) {
    for (const entry of value) {
      const text = pickLocalized(entry, preferred);
      if (text) return text;
    }
    return "";
  }
  if (typeof value === "object") {
    for (const key of preferred) {
      const candidate = value[key];
      const text = pickLocalized(candidate, preferred);
      if (text) return text;
    }
    for (const candidate of Object.values(value)) {
      const text = pickLocalized(candidate, preferred);
      if (text) return text;
    }
  }
  return "";
}

function cleanTedTitle(raw) {
  const text = String(raw || "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  // TED titles are formatted as "Ελλάδα – <CPV label> – <actual title>"
  const parts = text.split(/\s+[–-]\s+/);
  if (parts.length >= 3 && /^(?:Ελλάδα|Greece)$/i.test(parts[0].trim())) {
    const rest = parts.slice(2).join(" – ").trim();
    if (rest.length >= 18) return rest;
  }
  if (parts.length >= 2 && /^(?:Ελλάδα|Greece)$/i.test(parts[0].trim())) {
    return parts.slice(1).join(" – ").trim();
  }
  return text;
}

function parseTedDate(raw) {
  if (!raw) return undefined;
  const value = Array.isArray(raw) ? raw[0] : raw;
  const text = String(value || "").trim();
  if (!text) return undefined;
  // TED dates look like "2026-11-02+01:00" or "2026-11-02Z"
  const match = text.match(/^(\d{4}-\d{2}-\d{2})(?:([+-]\d{2}:\d{2}|Z))?$/);
  if (match) {
    const tz = match[2] || "Z";
    const parsed = new Date(`${match[1]}T08:00:00${tz}`);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  const fallback = new Date(text);
  return Number.isNaN(fallback.getTime()) ? undefined : fallback.toISOString();
}

function formatEuro(amount) {
  const num = Number(amount);
  if (!Number.isFinite(num) || num <= 0) return null;
  if (num >= 1_000_000) {
    const millions = (num / 1_000_000).toFixed(num >= 10_000_000 ? 1 : 2).replace(/\.0+$/, "");
    return `€${millions} εκατ.`;
  }
  return `€${Math.round(num).toLocaleString("el-GR")}`;
}

function formatShortDate(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("el-GR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Europe/Athens",
  }).format(d);
}

/**
 * Fetches official EU public procurement notices for Greece from the TED v3
 * Search API (https://api.ted.europa.eu/v3/notices/search), filtered to
 * telecom, energy-grid and civil-infrastructure CPV divisions.
 */
export class TedSourceAdapter {
  constructor(options = {}) {
    this.fetch = options.fetch || globalThis.fetch;
  }

  async load(source, { now = Date.now() } = {}) {
    const endpoint = source.url || DEFAULT_TED_URL;
    const country = source.country || "GRC";
    const lookbackDays = source.lookbackDays ?? 21;
    const cpvPrefixes = source.cpvPrefixes?.length ? source.cpvPrefixes : DEFAULT_CPV_PREFIXES;
    const sinceYmd = formatDateYmd(new Date(now - lookbackDays * 86_400_000));
    const cpvClause = cpvPrefixes.map((prefix) => `classification-cpv = ${prefix}*`).join(" OR ");
    const query = source.query
      || `organisation-country-buyer = ${country} AND PD >= ${sinceYmd} AND (${cpvClause})`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), source.timeoutMs || 12_000);
    try {
      const response = await this.fetch(endpoint, {
        method: "POST",
        headers: {
          "User-Agent": "GRWire/0.2 (+https://grwire.com)",
          "Content-Type": "application/json",
          Accept: "application/json",
          ...source.headers,
        },
        body: JSON.stringify({
          query,
          fields: [
            "ND",
            "TI",
            "PD",
            "buyer-name",
            "estimated-value-proc",
            "estimated-value-cur-proc",
            "deadline-receipt-tender-date-lot",
            "links",
          ],
          limit: Math.min(source.limit || 40, 100),
          page: 1,
          scope: source.scope || "ACTIVE",
        }),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`TED request failed (${response.status})`);
      const payload = await response.json();
      const notices = Array.isArray(payload?.notices) ? payload.notices : [];
      return this.parseNotices(notices, source);
    } catch (error) {
      if (error?.name === "AbortError") throw new Error("TED request timed out");
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  parseNotices(notices = [], source = {}) {
    const minValueEur = source.minValueEur ?? 0;
    const excludeTitlePatterns = (source.excludeTitlePatterns || []).map((pattern) => new RegExp(pattern, "iu"));

    return notices.flatMap((notice) => {
      const rawTitle = cleanTedTitle(pickLocalized(notice?.TI));
      if (!rawTitle) return [];
      const hasTenderWord = /(?:διαγωνισμ|διακηρυξ|προκηρυξ|αναθεσ|κατακυρωσ|προσκλησ|tender|award)/iu.test(rawTitle);
      const title = hasTenderWord ? rawTitle : `Διαγωνισμός: ${rawTitle}`;
      if (excludeTitlePatterns.some((pattern) => pattern.test(title))) return [];

      const nd = notice?.ND || notice?.["publication-number"];
      const htmlUrl = notice?.links?.html?.ELL
        || notice?.links?.html?.ENG
        || (nd ? `https://ted.europa.eu/el/notice/-/detail/${encodeURIComponent(nd)}` : null);
      if (!htmlUrl) return [];

      const rawValue = Array.isArray(notice?.["estimated-value-proc"])
        ? notice["estimated-value-proc"][0]
        : notice?.["estimated-value-proc"];
      const estimatedValueEur = Number(rawValue);
      const hasValue = Number.isFinite(estimatedValueEur) && estimatedValueEur > 0;
      if (minValueEur > 0 && hasValue && estimatedValueEur < minValueEur) return [];

      const buyer = pickLocalized(notice?.["buyer-name"]);
      const publishedAt = parseTedDate(notice?.PD);
      const deadlineIso = parseTedDate(notice?.["deadline-receipt-tender-date-lot"]);
      const summaryParts = [
        "Διαγωνισμός ΕΕ (TED)",
        buyer ? `Φορέας: ${buyer}` : null,
        hasValue ? `Προϋπολογισμός: ${formatEuro(estimatedValueEur)}` : null,
        deadlineIso ? `Προθεσμία: ${formatShortDate(deadlineIso)}` : null,
      ].filter(Boolean);
      const summary = summaryParts.join(" · ");

      if (source.titleFilter?.length) {
        if (!matchesAnyTerm(`${title} ${summary}`, source.titleFilter)) return [];
      }

      return [normalizeItem({
        id: nd || htmlUrl,
        url: htmlUrl,
        title,
        summary,
        publishedAt,
        metadata: {
          adapter: "ted",
          noticeNumber: nd || undefined,
          buyer: buyer || undefined,
          estimatedValueEur: hasValue ? estimatedValueEur : undefined,
          deadline: deadlineIso || undefined,
        },
      }, source.url || DEFAULT_TED_URL)];
    });
  }
}
