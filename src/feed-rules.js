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
// "δεθ" (ΔΕΘ, the Thessaloniki International Fair) is in this list too:
// round-4 owner answer — "Η ΔΕΗ στην 90η ΔΕΘ ..." must be dropped entirely,
// not merely homepage-suppressed like a generic event piece (see
// isEventPiece below).
const PPC_SPONSORSHIP_EVENT_TERMS = ["χορηγ*", "φεστιβαλ*", "εκδηλωσ*", "we4all", "τουρνουα*", "basketball", "3x3", "δεθ"];
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
  // round-4 owner answer: "μερισμα (unless sector org)" from the original
  // spec is superseded — ANY dividend mention is noise now, sector org or
  // not (see isStockRatingNoise/stock_market below for the rest of the
  // stock-market noise this round adds).
  market_wraps: ["χρηματιστηρι* κλεισιμο", "γενικοσ δεικτησ", "μερισμα", "μερισματ*", "περιθωρι* τραπεζ*"],
  off_topic: ["ακινητ*", "ενοικι*", "τουρισμ*", "ξενοδοχει*", "κρουαζιερ*", "αθλητ*", "γηπεδ*", "ποδοσφαιρ*", "τηλεοπτικ* προγραμμα"],
  marketing: ["διαφημιστικ* καμπανια*", "βραβει*"],
  // round-4: broker-note noise (target price, buyback language). The rating
  // combo (σύσταση + outperform/buy/neutral/overweight/underweight/hold, or
  // those rating words with other broker context) needs co-occurrence logic,
  // so it is handled by isStockRatingNoise() below instead of a plain term.
  stock_market: ["τιμη στοχο*", "τιμησ στοχου", "target price", "ιδιες μετοχεσ", "ιδιων μετοχων"],
  // round-5: consumer fuel/heating-price measures (heating/diesel fuel,
  // the heating/other subsidy, retail fuel-price roundups) are household
  // cost-of-living noise, not sector news.
  consumer_fuel: ["πετρελαιο θερμανσησ", "πετρελαιο κινησησ", "diesel κινησησ", "επιδομα*", "τιμες καυσιμων", "τιμη καυσιμων"],
});

// organizations.js has no telecom/energy/infrastructure classification field,
// so per the spec's fallback instruction this list is defined explicitly here;
// used by watch-rules.js' deals-companies rule (requiredEntities/bannedEntities).
export const SECTOR_ORGANIZATIONS = Object.freeze([
  "ΟΤΕ", "OTE", "Cosmote", "Vodafone", "Nova", "United Fiber",
  "ΔΕΗ", "PPC", "ΑΔΜΗΕ", "IPTO", "ΔΕΔΔΗΕ", "HEDNO", "ΔΕΣΦΑ", "ΔΕΠΑ",
  "Grid Telecom", "Intracom", "ΓΕΚ ΤΕΡΝΑ", "GEK TERNA", "Aktor", "AKTOR", "Metlen",
]);

// round-5 deals-companies gating (decisions.md): an item may carry the
// "deals" category only when title+summary name a sector company (reusing
// SECTOR_ORGANIZATIONS, whole-word matched via matchesAnyTerm) — a sector
// company with no deal language at all is still a deals story (e.g. a
// company's new investment). "αποτελέσματα" ("results") is the one signal
// that isn't enough on its own: when it's the *only* deals-ish term present
// (no other DEALS_WORD_TERMS alongside it), the company must specifically
// be in the title, not just the summary, to count. This is the fix for the
// ΕΕΤΤ/BEREC "Αποτελέσματα της ... Συνεδρίασης" false positive: no company
// is named at all, so it never qualifies regardless of this narrower rule.
// Applied as a single post-hoc gate in public-data.js
// (dropDealsWithoutCompany), regardless of whether "deals" came from the
// DEFAULT_WATCH_RULES rule or tier-1 topical routing, so both paths are
// tightened the same way.
const DEALS_WORD_TERMS = ["εξαγορ*", "συγχωνευσ*", "κοινοπραξ*", "πωλησ*", "αυξηση κεφαλαιου", "αυξησης κεφαλαιου", "ομολογ*"];
const DEALS_RESULTS_TERMS = ["αποτελεσματ*"];

export function hasSectorCompanyMention(text = "") {
  return matchesAnyTerm(text, SECTOR_ORGANIZATIONS);
}

export function isDealsEligible(article = {}) {
  const title = article.title || "";
  const text = `${title} ${article.summary || ""}`;
  if (!hasSectorCompanyMention(text)) return false;
  const resultsOnly = matchesAnyTerm(text, DEALS_RESULTS_TERMS) && !matchesAnyTerm(text, DEALS_WORD_TERMS);
  if (resultsOnly) return hasSectorCompanyMention(title);
  return true;
}

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

// round-4 owner answer (sources-spec.md noise_hard_reject, superseding the
// "μερισμα (unless sector org)" exception above): a broker rating only
// counts as noise when it's a σύσταση paired with a rating word, or a
// rating word next to other broker context — a bare "buy"/"hold" inside
// unrelated English text must not be rejected.
const STOCK_RATING_WORDS = ["outperform", "buy", "neutral", "overweight", "underweight", "hold"];
const STOCK_RECOMMENDATION_TERMS = ["συστασ*"];
const STOCK_BROKER_CONTEXT_TERMS = ["μεσιτικ*", "χρηματιστηριακ*", "αναλυτ*", "broker", "χρηματιστηρι*"];

function isStockRatingNoise(text) {
  if (!matchesAnyTerm(text, STOCK_RATING_WORDS)) return false;
  if (matchesAnyTerm(text, STOCK_RECOMMENDATION_TERMS)) return true;
  return matchesAnyTerm(text, STOCK_BROKER_CONTEXT_TERMS);
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

// round-5: marine-park/environment-only items are noise UNLESS the text also
// carries a grid/works angle — a θαλάσσιο πάρκο story about an ΑΔΜΗΕ/ΔΕΔΔΗΕ
// cable, substation or other works is sector news, not an environment-only
// piece, so the exclusion term list is checked the same way as
// isPpcNonNetwork/isStockRatingNoise above (co-occurrence, not a plain term).
const ENVIRONMENT_ONLY_TERMS = ["θαλασσι* παρκ*", "προστασια των θαλασσων", "προστασια τησ θαλασσασ"];
const GRID_WORKS_TERMS = ["δικτυ*", "διασυνδεσ*", "καλωδι*", "αδμηε", "δεδδηε", "εργ*", "υποσταθμ*"];

function isEnvironmentOnlyNoise(text) {
  return matchesAnyTerm(text, ENVIRONMENT_ONLY_TERMS) && !matchesAnyTerm(text, GRID_WORKS_TERMS);
}

// round-5 follow-up: consumer_fuel measures are identified by the HEADLINE,
// not the summary — a price-index story (e.g. construction materials) whose
// summary merely lists diesel/heating oil among its components is sector
// news, not a fuel-price piece, so this group is checked title-only (same
// co-occurrence-helper shape as isEnvironmentOnlyNoise/isStockRatingNoise
// above) instead of going through the title+summary loop below.
function consumerFuelNoiseTerm(title) {
  return NOISE_HARD_REJECT.consumer_fuel.find((term) => matchesAnyTerm(title, [term])) || null;
}

/**
 * Returns `{ group, term }` for the first noise_hard_reject term matched in
 * `item.title` + `item.summary`, or for the rules-based
 * political_quote_no_decision case, or `null` if the item should pass
 * through.
 */
export function noiseRejectReason(item = {}) {
  const title = item.title || "";
  const text = `${title} ${item.summary || ""}`;
  for (const [group, terms] of Object.entries(NOISE_HARD_REJECT)) {
    if (group === "consumer_fuel") continue;
    for (const term of terms) {
      if (!matchesAnyTerm(text, [term])) continue;
      if (group === "marketing" && term === "βραβει*" && matchesAnyTerm(text, CONTRACT_AWARD_TERMS)) continue;
      return { group, term };
    }
  }
  const consumerFuelTerm = consumerFuelNoiseTerm(title);
  if (consumerFuelTerm) return { group: "consumer_fuel", term: consumerFuelTerm };
  if (isStockRatingNoise(text)) return { group: "stock_market", term: null };
  if (isPpcNonNetwork(item, text)) return { group: "ppc_non_network", term: null };
  if (isPoliticalQuoteWithNoDecision(text)) return { group: "political_quote_no_decision", term: null };
  if (isEnvironmentOnlyNoise(text)) return { group: "environment_only", term: null };
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

// round-4: homepage backfill fills up to 12 total items with older-but-
// still-relevant coverage (up to this many hours old) when fewer than 12
// items are <72h old.
export const BACKFILL_MAX_AGE_HOURS = 24 * 7;
export const HOMEPAGE_BACKFILL_MIN_ITEMS = 12;

// round-4: the §7 nav-visibility window ("hide /tenders and /regulators
// until each has >=3 items") is a separate, wider window than the 72h
// homepage freshness window or the unbounded section-page "older" list.
export const SECTION_NAV_WINDOW_DAYS = 30;

/** How many of `articles` (any shape with `publishedAt`) fall within SECTION_NAV_WINDOW_DAYS of `now`. */
export function countWithinNavWindow(articles = [], { now = Date.now() } = {}) {
  return articles.filter((article) => isFresh(article, now, SECTION_NAV_WINDOW_DAYS * 24)).length;
}

// round-4 event-piece rule: title matches (case/accent-insensitive, Greek
// inflections handled by matchesAnyTerm's stemming).
// "συνέδριο" (conference) uses its exact closed-class inflections rather
// than a "συνεδρι*" stem, because that stem also catches "συνεδρίαση" /
// "συνεδριάζει" etc. — a board/plenary MEETING, not a conference.
const EVENT_TERMS = [
  "summit", "συνεδριο", "συνεδριου", "συνεδρια", "συνεδριων",
  "forum", "φορουμ*", "ημεριδ*", "εκδηλωσ*", "δεθ", "βραβευσ*",
];

/** Whether an article's title reads as an event/conference piece (sources-spec round-4 event rule). */
export function isEventPiece(title = "") {
  return matchesAnyTerm(title, EVENT_TERMS);
}

const POWER_UNIT_RE = /\d+[.,]?\d*\s*(mwh|mw|gw)\b/i;
const DECISION_WORD_TERMS = ["αποφασ*", "συμβασ*", "διαγωνισμ*", "εγκρ*"];

/** A figure (€ amount, MW/GW/MWh, νοικοκυριά count, a numbered γραμμή) or a decision word — the event-piece exception. */
export function hasFigureOrDecisionSignal(text = "") {
  if (hasEuroAmount(text)) return true;
  if (POWER_UNIT_RE.test(normaliseText(text))) return true;
  if (matchesAnyTerm(text, ["νοικοκυρι*"])) return true;
  if (matchesAnyTerm(text, ["γραμμ*"]) && /\d/.test(normaliseText(text))) return true;
  return matchesAnyTerm(text, DECISION_WORD_TERMS);
}

// round-4 Cyprus-only rule: a Cyprus mention with no Greece/Greek mention
// anywhere means the item is about Cyprus only.
const CYPRUS_TERMS = ["κυπρ*", "cyprus", "λευκωσι*", "cyta", "epic", "αηκ", "eac"];
const GREECE_TERMS = ["ελλαδ*", "ελλην*", "greece", "greek"];

/** sources-spec round-4: Cyprus-only items (no Greece/Greek mention) never appear on the homepage. */
export function isCyprusOnly(article = {}) {
  const text = `${article.title || ""} ${article.summary || ""}`;
  return matchesAnyTerm(text, CYPRUS_TERMS) && !matchesAnyTerm(text, GREECE_TERMS);
}

// round-4 telecom-fibre network-angle requirement: an item may only carry
// the telco category when title+summary actually name a network/technology
// angle or a named operator — a company being "telecom" in name/sector
// (e.g. matched only via the broader SPEC_SECTION_KEYWORDS/watch-rules.js
// generic topic terms) is not enough on its own.
const TELCO_NETWORK_ANGLE_TERMS = [
  "δικτυ*", "οπτικ*", "ftth", "fttx", "fttb", "fttc", "5g", "φασμα*", "κεραι*", "παροχ*",
  "εεττ", "καλωδι*", "υποθαλασσ*", "data center", "datacenter", "κεντρ* δεδομενων",
  "δορυφορ*", "χαλκ*",
  "οτε", "telekom", "cosmote", "vodafone", "nova", "united fiber", "united group",
  "δεη fiber", "grid telecom",
];

// round-4 fix: "δίκτυο συνεργατών/διανομής/πωλήσεων/καταστημάτων/..." (and the
// English "partner/dealer/distribution/sales network") is a commercial
// reseller/dealer network, not a telecom one — stripped out before matching
// TELCO_NETWORK_ANGLE_TERMS' generic "δικτυ*"/"network" terms so a story like
// "...στο δίκτυο συνεργατών της" (a vendor's dealer network) does not count
// as a telecom network angle just because it says "δίκτυο".
const COMMERCIAL_NETWORK_AFTER_TERMS = [
  "συνεργατων", "διανομησ", "διανομεων", "πωλησεων", "καταστηματων",
  "μεταπωλητων", "πρακτορων", "franchise", "λιανικησ",
];
const COMMERCIAL_NETWORK_BEFORE_TERMS = ["partner", "dealer", "distribution", "sales"];

/** Removes "δίκτυο <commercial term>" / "<commercial term> network" spans (within ~2 words) from `text`. */
function stripCommercialNetworkPhrases(text) {
  const tokens = tokenize(normaliseText(text));
  const removed = new Set();
  for (let i = 0; i < tokens.length; i += 1) {
    if (tokens[i].startsWith("δικτυ")) {
      for (let offset = 1; offset <= 2; offset += 1) {
        if (COMMERCIAL_NETWORK_AFTER_TERMS.includes(tokens[i + offset])) {
          removed.add(i);
          removed.add(i + offset);
          break;
        }
      }
    }
    if (tokens[i] === "network") {
      for (let offset = 1; offset <= 2; offset += 1) {
        if (COMMERCIAL_NETWORK_BEFORE_TERMS.includes(tokens[i - offset])) {
          removed.add(i);
          removed.add(i - offset);
          break;
        }
      }
    }
  }
  return tokens.filter((_token, index) => !removed.has(index)).join(" ");
}

/** Whether title+summary carry an actual telecom network/technology/operator angle (round-4 telco rule). */
export function hasTelecomNetworkAngle(text = "") {
  return matchesAnyTerm(stripCommercialNetworkPhrases(text), TELCO_NETWORK_ANGLE_TERMS);
}

/** Whether `text` matches at least one §1 keyword for `section`, honouring its negative list (round-4 tier-1 topical routing). */
export function specSectionKeywordMatch(text, section) {
  const config = SPEC_SECTION_KEYWORDS[section];
  if (!config) return false;
  if (config.negative.some((term) => matchesAnyTerm(text, [term]))) return false;
  return config.keywords.some((term) => matchesAnyTerm(text, [term]));
}

// round-5 tier-1 action-word rule (decisions.md): a tier-1 (regulator/
// government) item is only homepage-eligible when its TITLE carries a
// genuine regulatory/administrative action word — tier-1 sources also post
// a lot of agenda/diary content (visits, greetings, speeches) that reads as
// news but is not actually a decision/consultation/tender. Action-word
// tier-1 items also get a +10 score bonus (applied in watch-rules.js
// rankItems, the single place the final per-item score is computed) so they
// out-rank routine tier-1 coverage for lead choice and backfill ordering.
const TIER1_ACTION_WORD_TERMS = [
  "διαβουλευσ*", "αποφασ*", "νομοσχεδι*", "ρυθμισ*", "κανονισμ*", "προσκλησ*",
  "προκηρυξ*", "διαγωνισμ*", "εγκρισ*", "αδειοδοτησ*",
  "προγραμμα αναπτυξησ", "προγραμματος αναπτυξησ", "σχεδιο αναπτυξησ", "σχεδιου αναπτυξησ",
  "φασμα*", "δημοπρασι*", "εκχωρησ*",
];

export function hasTier1ActionWord(title = "") {
  return matchesAnyTerm(title, TIER1_ACTION_WORD_TERMS);
}

// Allows exactly one leading modifier word before the action-word phrase
// itself, so "Δημόσια Διαβούλευση …" (the formal name of a public
// consultation) still counts as "starting with" the "διαβουλευσ*" phrase,
// matching the spec's own example.
const STARTS_WITH_MAX_LEADING_WORDS = 1;

/** Anchored variant of matchesAnyTerm: true only when `text` STARTS WITH one of `terms` (allowing one leading word). */
function startsWithAnyTerm(text, terms = []) {
  const tokens = tokenize(normaliseText(text));
  return terms.some((term) => {
    const words = normaliseText(term).split(" ").filter(Boolean);
    if (!words.length) return false;
    for (let offset = 0; offset <= STARTS_WITH_MAX_LEADING_WORDS; offset += 1) {
      if (words.length + offset > tokens.length) continue;
      const matched = words.every((word, index) => {
        const token = tokens[offset + index];
        const isPrefix = word.endsWith("*");
        const stem = isPrefix ? word.slice(0, -1) : word;
        return isPrefix ? token.startsWith(stem) : token === stem;
      });
      if (matched) return true;
    }
    return false;
  });
}

// round-5 agenda-item rule (decisions.md): visit/participation/greeting/
// speech/interview-style titles — a minister's or official's diary, not a
// decision — never appear on the homepage, from ANY tier (not just tier 1).
const AGENDA_TERMS = [
  "επισκεψ*", "συναντησ*", "συμμετοχη του", "συμμετοχη τησ", "συμμετοχη του γενικου",
  "χαιρετισμ*", "ομιλι*", "συνεντευξ*",
];
// "<Capitalised Name> σε/στην/στη/στο/στον <Capitalised Place>" at the very
// start of the title, e.g. "Σταύρος Παπασταύρου σε Πάτμο και Λέρο: ...".
// Matched on the raw (not accent/case-normalised) title: capitalisation is
// the signal here, which normaliseText would destroy.
const NAME_VISIT_START_RE = /^[Α-ΩΆΈΉΊΌΎΏΪΫ][\p{L}'-]+\s+[Α-ΩΆΈΉΊΌΎΏΪΫ][\p{L}'-]+\s+(σε|στην|στη|στο|στον)\s+[Α-ΩΆΈΉΊΌΎΏΪΫ][\p{L}'-]+/u;
// "Στ(ην|ο|η|ον) <Place...> ο/η <Capitalised Name>" at the start, e.g.
// "Στην Πάτμο και τη Λέρο ο Σταύρος Παπασταύρου – ...".
const PLACE_VISIT_START_RE = /^Στ(ην|ο|η|ον)\s+.{0,40}?\s(ο|η)\s[Α-ΩΆΈΉΊΌΎΏΪΫ][\p{L}'-]+\s+[Α-ΩΆΈΉΊΌΎΏΪΫ][\p{L}'-]+/u;
// A title that is only a «…» quote, optionally prefixed by "Name: ".
const QUOTE_ONLY_TITLE_RE = /^(?:[^:«»\n]{1,60}:\s*)?«[^»]+»\s*$/u;

function isVisitStyleTitle(title = "") {
  const trimmed = String(title ?? "").trim();
  return NAME_VISIT_START_RE.test(trimmed) || PLACE_VISIT_START_RE.test(trimmed) || QUOTE_ONLY_TITLE_RE.test(trimmed);
}

/**
 * sources-spec round-5 agenda rule. Agenda OVERRIDES a tier-1 action word
 * (e.g. a ministerial visit that also happens to mention a νομοσχέδιο is
 * still a visit) EXCEPT when the action word is the source's own formal
 * act, approximated as the title STARTING WITH the action-word phrase (e.g.
 * "Δημόσια Διαβούλευση …", "Πρόσκληση …", "Απόφαση …") — that framing wins
 * over an agenda-shaped rest of the title.
 */
export function isAgendaItem(title = "") {
  if (!matchesAnyTerm(title, AGENDA_TERMS) && !isVisitStyleTitle(title)) return false;
  return !startsWithAnyTerm(title, TIER1_ACTION_WORD_TERMS);
}

/** round-5: an agenda item's score is capped at 39 regardless of any other bonus. */
export function agendaScoreCap(score, title) {
  return isAgendaItem(title) ? Math.min(score, 39) : score;
}
