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
  if (!rule.entities?.length && !rule.topics?.length) {
    throw new TypeError(`Watch rule ${rule.id} requires entities or topics`);
  }
  return {
    threshold: 5,
    category: "market",
    entities: [],
    topics: [],
    geography: [],
    exclusions: [],
    preferredDomains: [],
    ...rule,
  };
}

export function scoreItem(item, rawRule) {
  const rule = validateWatchRule(rawRule);
  const title = normalise(item.title);
  const summary = normalise(item.summary);
  const combined = `${title} ${summary}`;
  const domain = new URL(item.url).hostname.replace(/^www\./, "");
  const reasons = [];
  let score = 0;

  if (includesAny(title, rule.entities)) {
    score += 5;
    reasons.push("monitored entity in title");
  } else if (includesAny(summary, rule.entities)) {
    score += 3;
    reasons.push("monitored entity in summary");
  }

  if (includesAny(title, rule.topics)) {
    score += 3;
    reasons.push("watched topic in title");
  } else if (includesAny(summary, rule.topics)) {
    score += 2;
    reasons.push("watched topic in summary");
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
    label: "Greek telecom infrastructure",
    category: "telco",
    entities: ["ΟΤΕ", "Cosmote", "Vodafone", "Nova", "ΔΕΗ Fiber", "PPC Fiber", "ΕΕΤΤ", "EETT"],
    topics: ["FTTH", "fiber", "fibre", "5G", "οπτική ίνα", "ευρυζων", "spectrum", "data center"],
    geography: ["Greece", "Greek", "Ελλάδα", "ελλην"],
    exclusions: ["smartphone review", "consumer offer"],
    preferredDomains: ["eett.gr", "cosmote.gr", "vodafone.gr", "nova.gr", "dei.gr"],
    threshold: 5,
  },
  {
    id: "greek-energy-infrastructure",
    label: "Greek energy infrastructure",
    category: "energy",
    entities: ["ΑΔΜΗΕ", "ADMIE", "IPTO", "ΔΕΔΔΗΕ", "HEDNO", "ΔΕΣΦΑ", "DESFA", "ΡΑΑΕΥ", "RAAEY", "ΔΕΗ", "PPC"],
    topics: ["substation", "interconnection", "grid", "storage", "BESS", "υποσταθ", "διασύνδεσ", "αποθήκευση"],
    geography: ["Greece", "Greek", "Ελλάδα", "ελλην"],
    preferredDomains: ["admie.gr", "deddie.gr", "desfa.gr", "raaey.gr", "dei.gr"],
    threshold: 5,
  },
  {
    id: "greek-finance",
    label: "Greek finance and listed companies",
    category: "finance",
    entities: ["Alpha Bank", "Eurobank", "Εθνική Τράπεζα", "Πειραιώς", "Bank of Greece", "ATHEX", "Χρηματιστήριο Αθηνών"],
    topics: ["results", "earnings", "dividend", "acquisition", "bond", "κερδ", "μέρισμα", "εξαγορά", "ομόλογ"],
    geography: ["Greece", "Greek", "Ελλάδα", "ελλην"],
    preferredDomains: ["athexgroup.gr", "bankofgreece.gr"],
    threshold: 5,
  },
]);
