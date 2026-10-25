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

// §5 homepage.max_items / §1 homepage_cap (the six caps sum to this total).
export const HOMEPAGE_MAX_ITEMS = 20;
export const SECTION_SHARE_MAX = 0.35;
// §5: "applied after per-section caps". With the §1 caps below (max 4) this
// never actually binds, but it stays in the eligibility check.
export const SECTION_SHARE_CAP = Math.floor(SECTION_SHARE_MAX * HOMEPAGE_MAX_ITEMS);

// §1 homepage_cap, keyed by spec section id (not the public category slug —
// see CATEGORY_TO_SPEC_SECTION/homepageSectionOf below for the mapping).
export const SECTION_HOMEPAGE_CAPS = Object.freeze({
  "telecom-fibre": 4,
  "energy-grids": 4,
  "infrastructure-works": 3,
  "regulators-policy": 3,
  "tenders-contracts": 4,
  "deals-companies": 2,
});

// Public category (src/public-data.js PUBLIC_CATEGORIES key) -> its mapped
// §1 spec section id. tenders/regulators map onto their own spec section
// too (see RULES_ONLY_CATEGORY_BY_SPEC_SECTION below for how an article ever
// gets one of those two categories in the first place), but the override
// branch in homepageSectionOf recomputes the same result either way, so
// leaving them out here would not change behaviour.
export const CATEGORY_TO_SPEC_SECTION = Object.freeze({
  telco: "telecom-fibre",
  energy: "energy-grids",
  infrastructure: "infrastructure-works",
  deals: "deals-companies",
  tenders: "tenders-contracts",
  regulators: "regulators-policy",
});

// §1 keywords_el/keywords_en (+ negative), transcribed verbatim, for the two
// spec sections that have no public category of their own (regulators-policy,
// tenders-contracts) plus the four that do — used only to detect when an
// article's *homepage-capping* section should be overridden to regulators-policy
// or tenders-contracts instead of its mapped public category.
export const SPEC_SECTION_KEYWORDS = Object.freeze({
  "telecom-fibre": {
    keywords: [
      "οπτικ* ιν*", "ftth", "fttx", "fttb", "gigabit", "ευρυζωνικ*", "gigabit voucher",
      "λευκ* περιοχ*", "5g", "φασμα", "κεραι*", "ιστο*", "σταθμ* βασησ", "υποθαλασσι* καλωδι*",
      "κεντρ* δεδομενων", "data center*", "δικτυ* κορμου", "χονδρικ*", "οτε", "telekom",
      "cosmote", "vodafone", "nova", "united fiber", "δεη fiber", "grid telecom", "εεττ",
      "vdsl", "vectoring", "καμπιν*",
      "fibre", "fiber", "gigabit", "broadband", "spectrum", "tower*", "subsea cable",
      "submarine cable", "data centre*", "wholesale", "backhaul", "telecom*",
    ],
    negative: [],
  },
  "energy-grids": {
    keywords: [
      "αδμηε", "δεδδηε", "δεσφα", "διασυνδεσ*", "υποσταθμ*", "γραμμ* μεταφορασ",
      "δικτυ* διανομησ", "υψηλησ τασησ", "μεσησ τασησ", "αποθηκευσ* ενεργειασ", "μπαταρι*",
      "συνδεσ* απε", "ορ* συνδεσησ", "περικοπ*", "ραα*υ", "φυσικ* αερι*", "αγωγ*",
      "μετασχηματιστ*", "φωτοβολταικ*", "απε",
      "transmission", "distribution", "interconnector", "interconnection", "substation",
      "storage", "bess", "grid connection", "curtailment", "transformer*", "high voltage",
      "pipeline", "lng",
    ],
    negative: [],
  },
  "infrastructure-works": {
    keywords: [
      "εργ*", "εργολαβι*", "σδιτ", "παραχωρησ*", "σιδηροδρομ*", "μετρο αθην*",
      "μετρο θεσσαλονικ*", "αττικο μετρο", "σηραγγ*", "γεφυρ*", "οδικ* αξον*",
      "αυτοκινητοδρομ*", "εκσκαφ*", "αδει* εκσκαφησ", "χωροθετησ*", "υποδομ*",
      "ppp", "concession", "rail*", "metro", "tunnel*", "bridge*", "motorway",
      "civil works", "permit*",
    ],
    negative: [],
  },
  "regulators-policy": {
    keywords: [
      "εεττ", "ραα*υ", "γγττ", "υπεν", "υπουργει* ψηφιακ*", "αποφασ*", "διαβουλευσ*",
      "κανονισμ*", "νομοσχεδι*", "τροπολογι*", "φεκ", "προστιμ*", "φασμα", "δημοπρασι* φασματοσ",
      "regulator", "decision", "consultation", "regulation", "bill", "amendment", "fine",
      "spectrum auction", "eett", "raaey",
    ],
    negative: ["συνεντευξ*", "δηλωσ* χωρισ αποφασ*"],
  },
  "tenders-contracts": {
    keywords: [
      "διαγωνισμ*", "διακηρυξ*", "προκηρυξ*", "αναθεσ*", "κατακυρωσ*", "συμβασ*", "προσφορ*",
      "κημδησ", "ακηρυξ*",
      "tender", "award", "contract", "bid deadline", "rfp", "procurement",
    ],
    negative: [],
  },
  "deals-companies": {
    keywords: [
      "εξαγορ*", "συγχωνευσ*", "κοινοπραξι*", "μετοχ*", "μεριδι*", "αποτελεσματ*",
      "επενδυσ*", "capex", "χρηματοδοτησ*", "ομολογ*",
      "m&a", "merger", "acquisition", "jv", "joint venture", "stake", "results", "funding", "ipo",
    ],
    negative: ["χρηματιστηρι* κλεισιμο", "μερισμα", "τραπεζ*"],
  },
});

// round-3 owner answer (sources-spec.md §2.2 ppc-press): the source-level
// energy routing in watch-rules.js sourceForcedCategories is narrowed to
// network/business and fibre releases only; sponsorship/CSR/events and
// retail tariffs/programmes aimed at households or students are dropped
// outright, scoped to this one source. Checked here (rather than in
// watch-rules.js) so it runs through noiseRejectReason, which both
// pipeline.js (scan) and public-data.js (read) already call upstream of any
// forced-category routing — drop wins over keep for free.
const PPC_SPONSORSHIP_EVENT_TERMS = ["χορηγ*", "φεστιβαλ*", "εκδηλωσ*", "we4all", "τουρνουα*", "basketball", "3x3"];
const PPC_RETAIL_SUBJECT_TERMS = ["τιμολογ*", "προγραμμα*", "προιον*", "τιμη*"];
const PPC_RETAIL_AUDIENCE_TERMS = ["νοικοκυρι*", "οικιακ*", "φοιτητ*", "καταναλωτ*", "πελατ*"];

function isPpcNonNetwork(item, text) {
  if ((item.sourceId || item.source_id) !== "ppc-press") return false;
  if (matchesAnyTerm(text, PPC_SPONSORSHIP_EVENT_TERMS)) return true;
  return matchesAnyTerm(text, PPC_RETAIL_SUBJECT_TERMS) && matchesAnyTerm(text, PPC_RETAIL_AUDIENCE_TERMS);
}

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

// Counts the distinct §1 keywords (keywords_el + keywords_en) matched in
// `text` for `section`, honouring that section's negative list (any
// negative-term match zeroes the count, same as a noise_hard_reject veto).
function countKeywordHits(text, section) {
  const config = SPEC_SECTION_KEYWORDS[section];
  if (!config) return 0;
  if (config.negative.some((term) => matchesAnyTerm(text, [term]))) return 0;
  return config.keywords.filter((term) => matchesAnyTerm(text, [term])).length;
}

/**
 * Pure helper: which §1 spec section an article counts against for
 * *homepage capping* (SECTION_HOMEPAGE_CAPS) — not the same as its public
 * category/column. Starts from the mapped section for article.categories[0]
 * (CATEGORY_TO_SPEC_SECTION), then overrides to regulators-policy or
 * tenders-contracts when that section has >=2 keyword hits *and* strictly
 * more hits than the mapped section's own §1 keywords. Returns null when
 * neither a mapped section nor a qualifying override exists.
 */
export function homepageSectionOf(article = {}) {
  const mapped = CATEGORY_TO_SPEC_SECTION[article.categories?.[0]] || null;
  const text = `${article.title || ""} ${article.summary || ""}`;
  const mappedHits = mapped ? countKeywordHits(text, mapped) : 0;
  const override = ["regulators-policy", "tenders-contracts"]
    .map((section) => ({ section, hits: countKeywordHits(text, section) }))
    .filter((candidate) => candidate.hits >= 2 && candidate.hits > mappedHits)
    .sort((a, b) => b.hits - a.hits)[0];
  return override?.section || mapped;
}

// tenders-contracts/regulators-policy have no rule in watch-rules.js
// DEFAULT_WATCH_RULES (no "AI" equivalent in this codebase), so the rules
// override above is the only way an article ever gets the "tenders" or
// "regulators" public category — reusing homepageSectionOf keeps the
// category an article is filed under and the section it counts against for
// homepage capping (SECTION_HOMEPAGE_CAPS) always in agreement.
const RULES_ONLY_CATEGORY_BY_SPEC_SECTION = Object.freeze({
  "tenders-contracts": "tenders",
  "regulators-policy": "regulators",
});

/** Returns "tenders"/"regulators" when the §1 rules override qualifies for one of them, else null. */
export function rulesOverrideCategory(article = {}) {
  return RULES_ONLY_CATEGORY_BY_SPEC_SECTION[homepageSectionOf(article)] || null;
}

// §5 noise_hard_reject. Parenthetical notes in the spec ("(gadget)",
// "(unless sector org)", "(unless contract)") are instructions for this
// code, not match text, so they are not part of the term strings themselves.
export const NOISE_HARD_REJECT = Object.freeze({
  consumer_tech: ["review", "unboxing", "κινητο* τηλεφων*", "smartwatch", "gaming", "προσφορ* καταστηματ*"],
  market_wraps: ["χρηματιστηρι* κλεισιμο", "γενικοσ δεικτησ", "μερισμα", "περιθωρι* τραπεζ*"],
  off_topic: ["ακινητ*", "ενοικι*", "τουρισμ*", "ξενοδοχει*", "κρουαζιερ*", "αθλητ*", "γηπεδ*", "ποδοσφαιρ*", "τηλεοπτικ* προγραμμα"],
  marketing: ["διαφημιστικ* καμπανια*", "βραβει*"],
});

// organizations.js has no telecom/energy/infrastructure classification field,
// so per the spec's fallback instruction this list is defined explicitly here
// for the "μερισμα (unless sector org)" exception.
export const SECTOR_ORGANIZATIONS = Object.freeze([
  "ΟΤΕ", "OTE", "Cosmote", "Vodafone", "Nova", "United Fiber",
  "ΔΕΗ", "PPC", "ΑΔΜΗΕ", "IPTO", "ΔΕΔΔΗΕ", "HEDNO", "ΔΕΣΦΑ", "ΔΕΠΑ",
  "Grid Telecom", "Intracom", "ΓΕΚ ΤΕΡΝΑ", "GEK TERNA", "Aktor", "AKTOR", "Metlen",
]);

// §5 noise_hard_reject.marketing: "βραβει* (unless contract)" — an award
// claim only survives the reject when contract-award language is present.
const CONTRACT_AWARD_TERMS = ["συμβασ*", "αναθεσ*", "κατακυρωσ*", "contract", "award"];

// §5 noise_hard_reject.political_quote_no_decision: "AI type=opinion AND no
// org decision -> max score 39" (hidden, hide_below 40). There is no AI in
// this subset, so it is approximated rules-only, scoped tightly to avoid
// catching non-political statements (CEO interviews) or hard-news items
// phrased as a statement (tender "δηλώσεις ενδιαφέροντος", a minister
// announcing a priced deal): a statement/interview term, that isn't the
// "expression of interest" idiom, said by a political actor, with no
// decision term and no tender/contract/deal or euro-amount language.
const STATEMENT_ONLY_TERMS = ["συνεντευξ*", "δηλωσ*", "interview", "statement"];
const EXPRESSION_OF_INTEREST_TERMS = ["δηλωσ* ενδιαφεροντος", "expression* of interest"];
const POLITICAL_ACTOR_TERMS = [
  "υπουργ*", "υφυπουργ*", "πρωθυπουργ*", "βουλευτ*", "κυβερνησ*", "κομμα*", "αντιπολιτευσ*",
  "minister*", "government", "mp", "opposition",
];
const DECISION_TERMS = [
  "αποφασ*", "φεκ", "διαβουλευσ*", "κανονισμ*", "νομοσχεδι*", "τροπολογι*", "προστιμ*",
  "decision", "consultation", "regulation", "fine", "bill", "amendment",
];
// §1 tenders-contracts + deals-companies keywords: a political statement
// about priced/contracted hard news is real news, not an opinion quote.
const TENDER_DEAL_HARD_NEWS_TERMS = [
  ...SPEC_SECTION_KEYWORDS["tenders-contracts"].keywords,
  ...SPEC_SECTION_KEYWORDS["deals-companies"].keywords,
];
const EURO_AMOUNT_RE = /(€\s*\d|\d\s*€|\d[\d.,]*\s*(εκατ\.?\s*|δισ\.?\s*)?(ευρω|euro|eur\b))/;

function mentionsSectorOrganization(text) {
  return matchesAnyTerm(text, SECTOR_ORGANIZATIONS);
}

function hasEuroAmount(text) {
  return EURO_AMOUNT_RE.test(normaliseText(text));
}

function isPoliticalQuoteWithNoDecision(text) {
  const isStatement = matchesAnyTerm(text, STATEMENT_ONLY_TERMS)
    && !matchesAnyTerm(text, EXPRESSION_OF_INTEREST_TERMS);
  if (!isStatement) return false;
  if (!matchesAnyTerm(text, POLITICAL_ACTOR_TERMS)) return false;
  if (matchesAnyTerm(text, DECISION_TERMS)) return false;
  if (matchesAnyTerm(text, TENDER_DEAL_HARD_NEWS_TERMS)) return false;
  if (hasEuroAmount(text)) return false;
  return true;
}

/**
 * Returns `{ group, term }` for the first noise_hard_reject term matched in
 * `item.title` + `item.summary`, or for the rules-based
 * political_quote_no_decision case, or `null` if the item should pass
 * through.
 */
export function noiseRejectReason(item = {}) {
  const text = `${item.title || ""} ${item.summary || ""}`;
  for (const [group, terms] of Object.entries(NOISE_HARD_REJECT)) {
    for (const term of terms) {
      if (!matchesAnyTerm(text, [term])) continue;
      if (group === "market_wraps" && term === "μερισμα" && mentionsSectorOrganization(text)) continue;
      if (group === "marketing" && term === "βραβει*" && matchesAnyTerm(text, CONTRACT_AWARD_TERMS)) continue;
      return { group, term };
    }
  }
  if (isPpcNonNetwork(item, text)) return { group: "ppc_non_network", term: null };
  if (isPoliticalQuoteWithNoDecision(text)) return { group: "political_quote_no_decision", term: null };
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
