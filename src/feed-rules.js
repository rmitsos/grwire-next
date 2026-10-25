/**
 * Shared constants and matchers for sources-spec.md §5 "Global rules",
 * scoped to the subset implemented in this round: ingest/home per-source
 * caps, the homepage section-share cap, the 72h freshness window and the
 * noise_hard_reject term lists. AI scoring (§6) and the score formula/
 * thresholds of §5 are out of scope.
 */

// §5 ingest defaults; individual sources in config/sources.js override these.
export const DEFAULT_DAY_CAP_PER_SOURCE = 8;
export const DEFAULT_HOME_CAP_PER_SOURCE = 2;

// §1 homepage_cap values sum to 20 (4 columns); plus the single lead slot and
// the 12-item "recent" list already used by buildHomepageSections. There is
// no single spec number for total homepage capacity in this subset (spec
// §5 homepage.max_items 20 covers a different, out-of-scope layout), so we
// derive it from the layout actually rendered by the homepage today.
export const HOMEPAGE_CAPACITY = 1 + 12 + 4 * 5; // lead + recent + 4 columns x 5
export const SECTION_SHARE_MAX = 0.35;
export const SECTION_SHARE_CAP = Math.floor(SECTION_SHARE_MAX * HOMEPAGE_CAPACITY);

// §5 max_age_hours.news
export const MAX_AGE_HOURS_NEWS = 72;

/** normalise_text: lowercase, strip Greek accents/diacritics, final ς→σ, collapse whitespace. */
export function normaliseText(value = "") {
  return String(value ?? "")
    .toLocaleLowerCase("el")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ς/g, "σ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(text) {
  return text.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
}

// `*` is a prefix wildcard on that word; multi-word terms match consecutive
// words; terms without `*` match a whole word.
function termMatchesTokens(tokens, term) {
  const words = normaliseText(term).split(" ").filter(Boolean);
  if (!words.length) return false;
  for (let start = 0; start <= tokens.length - words.length; start += 1) {
    let matched = true;
    for (let offset = 0; offset < words.length; offset += 1) {
      const word = words[offset];
      const token = tokens[start + offset];
      const isPrefix = word.endsWith("*");
      const stem = isPrefix ? word.slice(0, -1) : word;
      if (isPrefix ? !token.startsWith(stem) : token !== stem) { matched = false; break; }
    }
    if (matched) return true;
  }
  return false;
}

export function matchesAnyTerm(text, terms = []) {
  const tokens = tokenize(normaliseText(text));
  return terms.some((term) => termMatchesTokens(tokens, term));
}

// §5 noise_hard_reject, scoped to the three groups implemented this round.
// Parenthetical notes in the spec ("(gadget)", "(unless sector org)",
// "(unless contract)") are instructions for this code, not match text, so
// they are not part of the term strings themselves.
export const NOISE_HARD_REJECT = Object.freeze({
  consumer_tech: ["review", "unboxing", "κινητο* τηλεφων*", "smartwatch", "gaming", "προσφορ* καταστηματ*"],
  market_wraps: ["χρηματιστηρι* κλεισιμο", "γενικοσ δεικτησ", "μερισμα", "περιθωρι* τραπεζ*"],
  off_topic: ["ακινητ*", "ενοικι*", "τουρισμ*", "ξενοδοχει*", "κρουαζιερ*", "αθλητ*", "γηπεδ*", "ποδοσφαιρ*", "τηλεοπτικ* προγραμμα"],
});

// organizations.js has no telecom/energy/infrastructure classification field,
// so per the spec's fallback instruction this list is defined explicitly here
// for the "μερισμα (unless sector org)" exception.
export const SECTOR_ORGANIZATIONS = Object.freeze([
  "ΟΤΕ", "OTE", "Cosmote", "Vodafone", "Nova", "United Fiber",
  "ΔΕΗ", "PPC", "ΑΔΜΗΕ", "IPTO", "ΔΕΔΔΗΕ", "HEDNO", "ΔΕΣΦΑ", "ΔΕΠΑ",
  "Grid Telecom", "Intracom", "ΓΕΚ ΤΕΡΝΑ", "GEK TERNA", "Aktor", "AKTOR", "Metlen",
]);

function mentionsSectorOrganization(text) {
  return matchesAnyTerm(text, SECTOR_ORGANIZATIONS);
}

/**
 * Returns `{ group, term }` for the first noise_hard_reject term matched in
 * `item.title` + `item.summary`, or `null` if the item should pass through.
 */
export function noiseRejectReason(item = {}) {
  const text = `${item.title || ""} ${item.summary || ""}`;
  for (const [group, terms] of Object.entries(NOISE_HARD_REJECT)) {
    for (const term of terms) {
      if (!matchesAnyTerm(text, [term])) continue;
      if (group === "market_wraps" && term === "μερισμα" && mentionsSectorOrganization(text)) continue;
      return { group, term };
    }
  }
  return null;
}

/** Europe/Athens calendar day (YYYY-MM-DD) for a publishedAt value, or for `now` if absent. */
export function athensDayKey(publishedAt, now = Date.now()) {
  const parsed = publishedAt ? new Date(publishedAt) : null;
  const effective = parsed && !Number.isNaN(parsed.getTime()) ? parsed : new Date(now);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Athens" }).format(effective);
}

/** §5 max_age_hours.news: items with no publishedAt are never fresh. */
export function isFresh(item, now = Date.now(), maxAgeHours = MAX_AGE_HOURS_NEWS) {
  if (!item?.publishedAt) return false;
  const published = Date.parse(item.publishedAt);
  if (Number.isNaN(published)) return false;
  const ageMs = Number(now) - published;
  return ageMs >= 0 && ageMs <= maxAgeHours * 3_600_000;
}

/** Splits already-sorted (newest/most relevant first) articles into fresh vs. older coverage. */
export function splitByFreshness(articles = [], { now = Date.now(), maxAgeHours = MAX_AGE_HOURS_NEWS } = {}) {
  const fresh = [];
  const older = [];
  for (const article of articles) (isFresh(article, now, maxAgeHours) ? fresh : older).push(article);
  return { fresh, older };
}
