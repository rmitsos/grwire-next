import { stripTrailingSiteSuffix } from "./article-quality.js";
import { ORGANIZATIONS } from "./organizations.js";

function normalise(value = "") {
  return String(value ?? "")
    .toLocaleLowerCase("el")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

// A word character for boundary purposes; Unicode-aware so it also covers
// Greek letters and digits.
const WORD_CHAR_RE = /[\p{L}\p{N}]/u;

function isWordChar(char) {
  return typeof char === "string" && char !== "" && WORD_CHAR_RE.test(char);
}

function letterCount(term) {
  return (term.match(/[\p{L}\p{N}]/gu) || []).length;
}

// A term only counts as a match at a word boundary: never mid-word (so "port"
// doesn't fire inside "report"/"support"/"sports", "ΟΤΕ" doesn't fire inside
// "ποτέ", "Nova" doesn't fire inside "innovation"). Short terms (<=4 letters)
// also require a word boundary at the end, i.e. a whole-word match; longer
// terms keep matching as a stem/prefix (so "τηλεπικοινων" still matches
// "τηλεπικοινωνίες" and "διαγωνισμ" still matches "διαγωνισμός").
function hasWordBoundaryMatch(text, term, index) {
  if (isWordChar(text[index - 1])) return false;
  if (letterCount(term) <= 4 && isWordChar(text[index + term.length])) return false;
  return true;
}

function termPresent(text, rawTerm) {
  const term = normalise(rawTerm);
  if (!term) return false;
  let fromIndex = 0;
  for (;;) {
    const index = text.indexOf(term, fromIndex);
    if (index === -1) return false;
    if (hasWordBoundaryMatch(text, term, index)) return true;
    fromIndex = index + 1;
  }
}

// A term entry is normally a plain string, but can also be
// `{ term, unless }`: the term only counts as a match when none of the
// `unless` terms (also word-boundary matched) are present in the same text.
// Used for context-dependent exclusions, e.g. an electricity-grid term should
// not exclude a story that also carries a fibre/telecom signal.
function includesAny(text, terms = []) {
  return terms.some((entry) => {
    if (entry && typeof entry === "object") {
      const { term, unless = [] } = entry;
      if (unless.length && includesAny(text, unless)) return false;
      return termPresent(text, term);
    }
    return termPresent(text, entry);
  });
}

// Entities/topics for the Greek telecom rule, pulled out so they can also be
// used as "this is actually a telecom story" signals that override the
// electricity-grid exclusions below (see TELCO_ENTITIES/TELECOM_SIGNALS).
const TELCO_ENTITIES = ["ΟΤΕ", "OTE", "Cosmote", "COSMOTE", "Vodafone", "Nova", "United Group", "Intracom Telecom", "Intracom", "ΔΕΗ Fiber", "PPC Fiber", "ΕΕΤΤ", "EETT", "Grid Telecom"];
const TELCO_STRONG_TOPICS = ["FTTH", "fiber", "fibre", "5G", "οπτική ίνα", "ευρυζων", "telecom", "τηλεπικοινων", "spectrum", "data center", "subsea cable", "network deployment", "carrier billing", "mobile billing", "mobile-billed", "electronic communications", "telecommunications bill", "Code of Conduct", "κώδικας δεοντολογίας", "υπηρεσίες αυξημένης χρέωσης", "χρεώσεις κινητής", "ΕΕΤΤ", "EETT", "Intracom Telecom", "roaming", "περιαγωγ", "numbering", "αριθμοδοτ"];
const ENERGY_STRONG_TOPICS = ["substation", "interconnection", "grid", "storage", "BESS", "υποσταθ", "διασύνδεσ", "αποθήκευση", "offshore wind"];
const INFRA_STRONG_TOPICS = ["data center", "subsea cable", "railway", "motorway", "metro", "port", "airport", "σιδηρόδρομ", "αυτοκινητόδρομ", "μετρό", "λιμάν", "αεροδρόμ", "ΣΔΙΤ", "PPP", "concession"];

// Fibre/telecom signals that mean an electricity-grid term (ΑΔΜΗΕ, ΔΕΔΔΗΕ,
// "ηλεκτρικ", ...) is incidental context rather than the actual subject, per
// sources-spec.md §1: "Interconnection/cable stories go to energy unless they
// mention fibre, data or a telecom operator; then telecom-fibre."
const TELECOM_SIGNALS_OVER_ELECTRICITY = [...TELCO_ENTITIES, ...TELCO_STRONG_TOPICS, "τηλεπικοινων", "telecom"];

// Any strong-infrastructure signal (telecom, energy or construction); used to
// tell a genuine fibre/grid/construction story apart from a hotel/lifestyle
// piece that happens to mention a hotel ("ξενοδοχείο") in passing.
const STRONG_INFRASTRUCTURE_SIGNALS = [...TELCO_STRONG_TOPICS, ...ENERGY_STRONG_TOPICS, ...INFRA_STRONG_TOPICS];

// Checked against every rule, regardless of topic/entity matches: rental and
// residential-real-estate stories keep clearing the infrastructure/finance
// thresholds on geography + preferred-source bonuses alone, so they are
// rejected before any rule-specific scoring runs. Narrow and specific so that
// fibre/FTTH coverage stories that happen to mention "κατοικίες" (households
// passed, not homes for rent/sale) are not caught by this net.
const GLOBAL_EXCLUSIONS = [
  "ενοικ",
  "οικιστικ",
  "κατοικιες προς πωληση",
  "κατοικιες προς ενοικιαση",
  "πολυτελεις κατοικιες",
  "πολυτελη κατοικια",
  "real estate",
  "rental",
  "luxury residence",
  "decathlon",
  "πιτσα φαν",
  "καμπανι",
  { term: "ξενοδοχ", unless: STRONG_INFRASTRUCTURE_SIGNALS },
];

// Large-cap/systemic Greek listed companies and regulated utilities. Finance
// stories must mention one of these to qualify; generic market words
// ("χρηματιστήριο", "μέρισμα") or a small-cap name alone are not enough.
const MONITORED_COMPANIES = [
  ...ORGANIZATIONS.flatMap((organization) => [organization.name, ...(organization.aliases || [])]),
  "GEK TERNA", "ΓΕΚ ΤΕΡΝΑ", "Mytilineos", "Metlen", "AKTOR", "Intrakat", "AVAX", "ΑΒΑΞ",
  "Ellaktor", "Ελλάκτωρ", "Jumbo", "ΟΠΑΠ", "OPAP", "Motor Oil", "Titan Cement", "ΤΙΤΑΝ",
  "Aegean Airlines", "Coca-Cola HBC", "Cenergy", "Intralot", "Autohellas", "Lamda Development",
];

export function validateWatchRule(rule) {
  if (!rule?.id || !rule?.label) throw new TypeError("Watch rules require id and label");
  if (!rule.entities?.length && !rule.topics?.length && !rule.strongTopics?.length) {
    throw new TypeError(`Watch rule ${rule.id} requires entities or topics`);
  }
  return {
    threshold: 5,
    category: "market",
    entities: [],
    topics: [],
    strongTopics: [],
    geography: [],
    exclusions: [],
    requiredTopics: [],
    requiredEntities: [],
    minimumStrongTopics: 0,
    preferredDomains: [],
    ...rule,
  };
}

export function scoreItem(item, rawRule) {
  const rule = validateWatchRule(rawRule);
  const title = normalise(stripTrailingSiteSuffix(item.title || ""));
  const summary = normalise(item.summary);
  const body = normalise(item.metadata?.articleBody);
  const combined = `${title} ${summary} ${body}`;
  const domain = new URL(item.url).hostname.replace(/^www\./, "");
  const reasons = [];
  let score = 0;

  if (includesAny(combined, GLOBAL_EXCLUSIONS)) {
    return { ruleId: rule.id, label: rule.label, category: rule.category, score: 0, accepted: false, reasons: ["excluded lifestyle/rental/retail content"] };
  }

  if (includesAny(title, rule.entities)) {
    score += 5;
    reasons.push("monitored entity in title");
  } else if (includesAny(summary, rule.entities)) {
    score += 3;
    reasons.push("monitored entity in summary");
  } else if (includesAny(body, rule.entities)) {
    score += 2;
    reasons.push("monitored entity in article");
  }

  if (includesAny(title, rule.topics)) {
    score += 3;
    reasons.push("watched topic in title");
  } else if (includesAny(summary, rule.topics)) {
    score += 2;
    reasons.push("watched topic in summary");
  } else if (includesAny(body, rule.topics)) {
    score += 1;
    reasons.push("watched topic in article");
  }

  if (includesAny(title, rule.strongTopics)) {
    score += 5;
    reasons.push("high-signal topic in title");
  } else if (includesAny(summary, rule.strongTopics)) {
    score += 3;
    reasons.push("high-signal topic in summary");
  } else if (includesAny(body, rule.strongTopics)) {
    score += 2;
    reasons.push("high-signal topic in article");
  }

  if (rule.geography.length && includesAny(combined, rule.geography)) {
    score += 2;
    reasons.push("Greek market connection");
  }

  if (rule.preferredDomains.some((preferred) => domain === preferred || domain.endsWith(`.${preferred}`))) {
    score += 2;
    reasons.push("preferred source");
  }

  if (includesAny(combined, rule.exclusions)) {
    score -= 6;
    reasons.push("excluded context");
  }

  const requiredMatches = rule.requiredTopics.filter((term) => includesAny(combined, [term]));
  const strongMatches = rule.strongTopics.filter((term) => includesAny(combined, [term]));
  if (rule.requiredTopics.length && !requiredMatches.length) {
    score = 0;
    reasons.push("required infrastructure subject missing");
  }
  if (strongMatches.length < rule.minimumStrongTopics) {
    score = 0;
    reasons.push("insufficient high-signal subject detail");
  }
  if (rule.requiredEntities.length && !includesAny(combined, rule.requiredEntities)) {
    score = 0;
    reasons.push("no monitored company match");
  }

  return {
    ruleId: rule.id,
    label: rule.label,
    category: rule.category,
    score,
    accepted: score >= rule.threshold,
    reasons,
  };
}

export function rankItems(items, rules) {
  return items
    .map((item) => {
      const matches = rules.map((rule) => scoreItem(item, rule)).filter((match) => match.accepted);
      return {
        ...item,
        relevance: matches.sort((a, b) => b.score - a.score),
        score: Math.max(0, ...matches.map((match) => match.score)),
      };
    })
    .filter((item) => item.relevance.length)
    .sort((a, b) => b.score - a.score || Date.parse(b.publishedAt || 0) - Date.parse(a.publishedAt || 0));
}

// Fixed order used only to break ties when two rules score an item equally;
// keeps the homepage's single-column placement deterministic.
const CATEGORY_ORDER = ["energy", "telco", "infrastructure", "finance"];

export function primarySector(item, rules = DEFAULT_WATCH_RULES) {
  const [ranked] = rankItems([item], rules);
  if (!ranked || !ranked.relevance.length) return null;
  const topScore = ranked.relevance[0].score;
  const tied = ranked.relevance.filter((match) => match.score === topScore);
  if (tied.length === 1) return tied[0].category;
  tied.sort((a, b) => CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category));
  return tied[0].category;
}

export const DEFAULT_WATCH_RULES = Object.freeze([
  {
    id: "greek-telco-infrastructure",
    label: "Greek telecom market",
    category: "telco",
    entities: TELCO_ENTITIES,
    topics: ["telecom", "telecommunications", "electronic communications", "network", "broadband", "κινητή", "τηλεπικοινων", "ηλεκτρονικες επικοινωνιες", "roaming", "περιαγωγ", "numbering", "αριθμοδοτ", "carrier billing", "mobile billing", "mobile-billed", "telecom bill", "χρεωσ", "συνδρομητ"],
    strongTopics: TELCO_STRONG_TOPICS,
    geography: ["Greece", "Greek", "Ελλάδα", "ελλην"],
    exclusions: [
      "smartphone review",
      "consumer offer",
      { term: "ηλεκτρικ", unless: TELECOM_SIGNALS_OVER_ELECTRICITY },
      { term: "electricity", unless: TELECOM_SIGNALS_OVER_ELECTRICITY },
      { term: "ΑΔΜΗΕ", unless: TELECOM_SIGNALS_OVER_ELECTRICITY },
      { term: "IPTO", unless: TELECOM_SIGNALS_OVER_ELECTRICITY },
      { term: "ΔΕΔΔΗΕ", unless: TELECOM_SIGNALS_OVER_ELECTRICITY },
      { term: "δίκτυο μεταφοράς", unless: TELECOM_SIGNALS_OVER_ELECTRICITY },
      { term: "καλώδιο ρεύματος", unless: TELECOM_SIGNALS_OVER_ELECTRICITY },
    ],
    requiredTopics: ["FTTH", "fiber", "fibre", "οπτική ίνα", "5G", "spectrum", "data center", "subsea cable", "network deployment", "δικτυακή ανάπτυξη", "telecom", "telecommunications", "τηλεπικοινων", "electronic communications", "carrier billing", "mobile billing", "mobile-billed", "telecommunications bill", "Code of Conduct", "κώδικας δεοντολογίας", "υπηρεσίες αυξημένης χρέωσης", "χρεώσεις κινητής", "Intracom Telecom", "roaming", "περιαγωγ", "numbering", "αριθμοδοτ"],
    minimumStrongTopics: 1,
    preferredDomains: ["eett.gr", "cosmote.gr", "vodafone.gr", "nova.gr", "ot.gr", "intracom-telecom.com", "dei.gr"],
    threshold: 4,
  },
  {
    id: "greek-energy-infrastructure",
    label: "Greek energy infrastructure",
    category: "energy",
    entities: ["ΑΔΜΗΕ", "ADMIE", "IPTO", "ΔΕΔΔΗΕ", "HEDNO", "ΔΕΣΦΑ", "DESFA", "ΡΑΑΕΥ", "RAAEY", "ΔΕΗ", "PPC"],
    topics: ["energy", "electricity", "renewable", "gas", "ενέργεια", "ηλεκτρ", "ΑΠΕ"],
    strongTopics: ENERGY_STRONG_TOPICS,
    geography: ["Greece", "Greek", "Ελλάδα", "ελλην"],
    preferredDomains: ["admie.gr", "deddie.gr", "desfa.gr", "raaey.gr", "dei.gr"],
    requiredTopics: ["grid", "substation", "interconnection", "storage", "BESS", "υποσταθ", "διασύνδεσ", "αποθήκευση", "offshore wind", "renewable", "ΑΠΕ"],
    minimumStrongTopics: 1,
    threshold: 4,
  },
  {
    id: "greek-finance",
    label: "Greek finance and listed companies",
    category: "finance",
    entities: ["Alpha Bank", "Eurobank", "Εθνική Τράπεζα", "National Bank of Greece", "Πειραιώς", "Piraeus Bank", "Bank of Greece", "Τράπεζα της Ελλάδος", "ATHEX", "Χρηματιστήριο Αθηνών"],
    topics: ["bank", "market", "investment", "δάνει", "επένδυ", "χρηματιστηρ"],
    strongTopics: ["results", "earnings", "dividend", "acquisition", "merger", "bond", "κερδ", "μέρισμα", "εξαγορά", "συγχώνευση", "ομόλογ"],
    geography: ["Greece", "Greek", "Ελλάδα", "ελλην"],
    preferredDomains: ["athexgroup.gr", "bankofgreece.gr"],
    requiredEntities: MONITORED_COMPANIES,
    threshold: 4,
  },
  {
    id: "greek-infrastructure",
    label: "Greek infrastructure and construction",
    category: "infrastructure",
    entities: ["AKTOR", "Intrakat", "GEK TERNA", "ΓΕΚ ΤΕΡΝΑ", "AVAX", "ΑΒΑΞ", "Metlen", "Ellaktor", "Ελλάκτωρ", "Circet"],
    topics: ["infrastructure", "construction", "project", "παραχώρηση", "κατασκευ", "έργο"],
    strongTopics: INFRA_STRONG_TOPICS,
    geography: ["Greece", "Greek", "Ελλάδα", "ελλην"],
    preferredDomains: ["ypodomes.com", "ered.gr"],
    requiredTopics: ["data center", "subsea cable", "railway", "motorway", "metro", "port", "airport", "σιδηρόδρομ", "αυτοκινητόδρομ", "μετρό", "λιμάν", "αεροδρόμ", "ΣΔΙΤ", "PPP", "concession", "διαγωνισμ", "σύμβαση", "έργο ύψους"],
    minimumStrongTopics: 1,
    threshold: 4,
  },
]);
