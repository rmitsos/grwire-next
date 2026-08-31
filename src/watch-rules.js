function normalise(value = "") {
  return value
    .toLocaleLowerCase("el")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function includesAny(text, terms = []) {
  return terms.some((term) => text.includes(normalise(term)));
}

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
    minimumStrongTopics: 0,
    preferredDomains: [],
    ...rule,
  };
}

export function scoreItem(item, rawRule) {
  const rule = validateWatchRule(rawRule);
  const title = normalise(item.title);
  const summary = normalise(item.summary);
  const body = normalise(item.metadata?.articleBody);
  const combined = `${title} ${summary} ${body}`;
  const domain = new URL(item.url).hostname.replace(/^www\./, "");
  const reasons = [];
  let score = 0;

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

export const DEFAULT_WATCH_RULES = Object.freeze([
  {
    id: "greek-telco-infrastructure",
    label: "Greek telecom market",
    category: "telco",
    entities: ["ΟΤΕ", "OTE", "Cosmote", "COSMOTE", "Vodafone", "Nova", "United Group", "Intracom Telecom", "Intracom", "ΔΕΗ Fiber", "PPC Fiber", "ΕΕΤΤ", "EETT"],
    topics: ["telecom", "telecommunications", "electronic communications", "network", "broadband", "κινητή", "τηλεπικοινων", "ηλεκτρονικες επικοινωνιες", "roaming", "περιαγωγ", "numbering", "αριθμοδοτ", "interconnection", "διασυνδεσ", "carrier billing", "mobile billing", "mobile-billed", "telecom bill", "χρεωσ", "συνδρομητ"],
    strongTopics: ["FTTH", "fiber", "fibre", "5G", "οπτική ίνα", "ευρυζων", "telecom", "τηλεπικοινων", "spectrum", "data center", "subsea cable", "network deployment", "carrier billing", "mobile billing", "mobile-billed", "electronic communications", "telecommunications bill", "Code of Conduct", "κώδικας δεοντολογίας", "υπηρεσίες αυξημένης χρέωσης", "χρεώσεις κινητής", "ΕΕΤΤ", "EETT", "Intracom Telecom", "roaming", "περιαγωγ", "numbering", "αριθμοδοτ", "interconnection", "διασυνδεσ"],
    geography: ["Greece", "Greek", "Ελλάδα", "ελλην"],
    exclusions: ["smartphone review", "consumer offer"],
    requiredTopics: ["FTTH", "fiber", "fibre", "οπτική ίνα", "5G", "spectrum", "data center", "subsea cable", "network deployment", "δικτυακή ανάπτυξη", "telecom", "telecommunications", "τηλεπικοινων", "electronic communications", "carrier billing", "mobile billing", "mobile-billed", "telecommunications bill", "Code of Conduct", "κώδικας δεοντολογίας", "υπηρεσίες αυξημένης χρέωσης", "χρεώσεις κινητής", "Intracom Telecom", "roaming", "περιαγωγ", "numbering", "αριθμοδοτ", "interconnection", "διασυνδεσ"],
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
    strongTopics: ["substation", "interconnection", "grid", "storage", "BESS", "υποσταθ", "διασύνδεσ", "αποθήκευση", "offshore wind"],
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
    threshold: 4,
  },
  {
    id: "greek-infrastructure",
    label: "Greek infrastructure and construction",
    category: "infrastructure",
    entities: ["AKTOR", "Intrakat", "GEK TERNA", "ΓΕΚ ΤΕΡΝΑ", "AVAX", "ΑΒΑΞ", "Metlen", "Ellaktor", "Ελλάκτωρ", "Circet"],
    topics: ["infrastructure", "construction", "project", "παραχώρηση", "κατασκευ", "έργο"],
    strongTopics: ["data center", "subsea cable", "railway", "motorway", "concession", "σιδηρόδρομ", "αυτοκινητόδρομ"],
    geography: ["Greece", "Greek", "Ελλάδα", "ελλην"],
    preferredDomains: ["ypodomes.com", "ered.gr"],
    threshold: 4,
  },
]);
