import { normalizeItem } from "./utils.js";
import { matchesAnyTerm } from "../feed-rules.js";

const DEFAULT_DIAVGEIA_URL = "https://diavgeia.gov.gr/luminapi/opendata/search.json";
const DEFAULT_DECISION_TYPES = ["Δ.2.1", "Δ.2.2"];
const DEFAULT_CPV_PREFIXES = [
  "642", "324", "325",
  "093", "311", "312", "313",
  "4523",
];
const DECISION_TYPE_LABELS = {
  "Δ.1": "Ανάθεση σύμβασης",
  "Δ.2.1": "Περίληψη διακήρυξης",
  "Δ.2.2": "Κατακύρωση διαγωνισμού",
};

const PRESERVE_ACRONYMS = new Set([
  "ΟΤΕ", "ΔΕΗ", "ΑΔΜΗΕ", "ΔΕΔΔΗΕ", "ΔΕΣΦΑ", "ΔΑΠΕΕΠ", "ΕΕΤΤ", "ΡΑΑΕΥ", "ΥΠΕΝ", "ΓΓΤΤ",
  "ΚΗΜΔΗΣ", "ΕΣΗΔΗΣ", "ΣΔΙΤ", "ΑΠΕ", "ΟΠΣ", "ΤΑΑ", "ΕΣΠΑ", "ΒΟΑΚ", "ΟΣΕ", "ΟΛΠ", "ΟΛΘ",
  "FTTH", "FTTB", "FTTX", "5G", "FWA", "BESS", "LNG", "FSRU", "PPP", "UFBB", "ICT", "IT",
  "ΑΕ", "Α.Ε.", "ΑΕΕ", "ΟΕ", "ΕΕ", "ΕΠΕ", "ΙΚΕ", "ΝΠΔΔ", "ΝΠΙΔ", "ΔΕΥΑ",
]);

function formatYmd(date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Athens" }).format(date);
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

/**
 * Diavgeia subjects are often ALL-CAPS Greek. Convert screaming ALL-CAPS lines
 * to readable sentence case while preserving known sector acronyms and mixed-case titles.
 */
export function humanizeDiavgeiaSubject(subject = "") {
  const clean = String(subject || "").replace(/\s+/g, " ").trim();
  if (!clean) return "";
  const letters = clean.replace(/[^\p{L}]/gu, "");
  const isAllCaps = letters.length >= 12 && letters === letters.toLocaleUpperCase("el");
  if (!isAllCaps) return clean;
  const words = clean.split(" ");
  return words.map((word, index) => {
    const bare = word.replace(/^["«(\[]+|["»)\],.;:]+$/g, "");
    if (PRESERVE_ACRONYMS.has(bare)) return word;
    const lowered = word.toLocaleLowerCase("el");
    if (index === 0) return lowered.replace(/^\p{L}/u, (ch) => ch.toLocaleUpperCase("el"));
    return lowered;
  }).join(" ");
}

function extractAmountEur(extra = {}) {
  for (const key of ["estimatedAmount", "awardAmount", "amountWithVAT", "amountWithoutVAT"]) {
    const entry = extra?.[key];
    const value = typeof entry === "object" && entry !== null ? Number(entry.amount) : Number(entry);
    if (Number.isFinite(value) && value > 0) return value;
  }
  return null;
}

function hasSectorCpv(cpvs = [], prefixes = DEFAULT_CPV_PREFIXES) {
  if (!Array.isArray(cpvs) || !cpvs.length) return false;
  return cpvs.some((code) => {
    const normalized = String(code || "").trim();
    return prefixes.some((prefix) => normalized.startsWith(prefix));
  });
}

/**
 * Fetches high-value public procurement notices & contract awards from the
 * official Greek Government Diavgeia OpenData API
 * (https://diavgeia.gov.gr/luminapi/opendata/search.json).
 */
export class DiavgeiaSourceAdapter {
  constructor(options = {}) {
    this.fetch = options.fetch || globalThis.fetch;
  }

  async load(source, { now = Date.now() } = {}) {
    const endpoint = source.url || DEFAULT_DIAVGEIA_URL;
    const decisionTypes = source.decisionTypes?.length ? source.decisionTypes : DEFAULT_DECISION_TYPES;
    const lookbackDays = source.lookbackDays ?? 14;
    const fromDate = formatYmd(new Date(now - lookbackDays * 86_400_000));
    const pageSize = Math.min(source.pageSize || 100, 500);

    const batches = await Promise.all(decisionTypes.map(async (decisionType) => {
      const url = new URL(endpoint);
      url.searchParams.set("type", decisionType);
      url.searchParams.set("from_issue_date", fromDate);
      url.searchParams.set("size", String(pageSize));
      if (source.query) url.searchParams.set("q", source.query);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), source.timeoutMs || 12_000);
      try {
        const response = await this.fetch(url, {
          headers: {
            "User-Agent": "GRWire/0.2 (+https://grwire.com)",
            Accept: "application/json",
            ...source.headers,
          },
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`Diavgeia request failed (${response.status})`);
        const payload = await response.json();
        return Array.isArray(payload?.decisions) ? payload.decisions : [];
      } catch (error) {
        if (error?.name === "AbortError") throw new Error("Diavgeia request timed out");
        throw error;
      } finally {
        clearTimeout(timeout);
      }
    }));

    return this.parseDecisions(batches.flat(), source).slice(0, source.limit || 40);
  }

  parseDecisions(decisions = [], source = {}) {
    const minAmountEur = source.minAmountEur ?? 500_000;
    const cpvPrefixes = source.cpvPrefixes?.length ? source.cpvPrefixes : DEFAULT_CPV_PREFIXES;
    const excludeTitlePatterns = (source.excludeTitlePatterns || []).map((pattern) => new RegExp(pattern, "iu"));
    const seenAda = new Set();

    return decisions.flatMap((decision) => {
      const ada = String(decision?.ada || "").trim();
      if (!ada || seenAda.has(ada)) return [];
      seenAda.add(ada);

      const rawSubject = String(decision?.subject || "").trim();
      if (rawSubject.length < 18) return [];
      const cleanSubject = humanizeDiavgeiaSubject(rawSubject);
      const hasProcurementWord = /(?:διαγωνισμ|διακηρυξ|προκηρυξ|αναθεσ|κατακυρωσ|προσκλησ|συμβασ)/iu.test(cleanSubject);
      const prefix = decision.decisionTypeId === "Δ.2.2" ? "Κατακύρωση: " : "Διαγωνισμός: ";
      const title = hasProcurementWord ? cleanSubject : `${prefix}${cleanSubject}`;
      if (excludeTitlePatterns.some((pattern) => pattern.test(title))) return [];

      const extra = decision?.extraFieldValues || {};
      const amountEur = extractAmountEur(extra);
      if (minAmountEur > 0 && (!amountEur || amountEur < minAmountEur)) return [];

      const cpvs = Array.isArray(extra.cpv) ? extra.cpv : [];
      const cpvMatched = hasSectorCpv(cpvs, cpvPrefixes);
      const keywordMatched = source.titleFilter?.length ? matchesAnyTerm(title, source.titleFilter) : true;
      if (!cpvMatched && !keywordMatched) return [];
      if (source.requireTitleFilter && !keywordMatched) return [];

      const typeLabel = DECISION_TYPE_LABELS[decision.decisionTypeId] || "Διαγωνισμός / Σύμβαση";
      const adam = extra.adam || decision.adam || null;
      const summaryParts = [
        `${typeLabel} (Διαύγεια)`,
        amountEur ? `Ποσό: ${formatEuro(amountEur)}` : null,
        adam ? `ΑΔΑΜ: ${adam}` : null,
        `ΑΔΑ: ${ada}`,
      ].filter(Boolean);

      const publishedAt = decision.issueDate
        ? new Date(Number(decision.issueDate)).toISOString()
        : undefined;
      const viewUrl = `https://diavgeia.gov.gr/decision/view/${encodeURIComponent(ada)}`;

      return [normalizeItem({
        id: ada,
        url: viewUrl,
        title,
        summary: summaryParts.join(" · "),
        publishedAt,
        metadata: {
          adapter: "diavgeia",
          ada,
          adam: adam || undefined,
          decisionTypeId: decision.decisionTypeId || undefined,
          amountEur: amountEur || undefined,
          cpv: cpvs.length ? cpvs : undefined,
        },
      }, source.url || DEFAULT_DIAVGEIA_URL)];
    });
  }
}
