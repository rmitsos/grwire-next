import { analyseArticle } from "./market-analyst.js";
import { collapseDuplicateArticles } from "../article-quality.js";

const SIGNALS = [
  { label: "FTTH and fibre", terms: ["ftth", "fiber", "fibre", "οπτικη ινα", "οπτικες ινες"] },
  { label: "5G and spectrum", terms: ["5g", "5g+", "5g advanced", "spectrum", "φασμα", "6g"] },
  { label: "enterprise connectivity", terms: ["enterprise connectivity", "private 5g", "ιδιωτικα δικτυα", "ufbb", "fwa", "broadband"] },
  { label: "AI and network operations", terms: ["artificial intelligence", "ai", "τεχνητη νοημοσυνη", "data center", "data centre", "edge-cloud", "network automation"] },
  { label: "regulation and customer trust", terms: ["eett", "εεττ", "mobile-billed", "mobile billing", "carrier billing", "code of conduct", "κωδικας δεοντολογιας", "χρεωσ"] },
  { label: "bundled services and competition", terms: ["bundle", "bundled", "πακετ", "competition", "ανταγωνισ", "cosmote", "vodafone", "nova", "δεη fiber"] },
  { label: "grid capacity and storage", terms: ["grid", "δικτυο", "substation", "υποσταθ", "storage", "αποθηκευση", "bess", "interconnection", "διασυνδεσ"] },
  { label: "renewables and energy transition", terms: ["renewable", "ανανεωσιμ", "απε", "solar", "wind", "αιολ", "photovoltaic", "φωτοβολτα"] },
];

const ORGANISATIONS = ["OTE", "Cosmote", "Vodafone", "Nova", "Intracom Telecom", "United Fiber", "DEI Fiber", "ΔΕΗ", "EETT", "ΕΕΤΤ", "ADMIE", "IPTO", "RAAEY", "ΡΑΑΕΥ", "DESFA", "ΔΕΔΔΗΕ"];

/** Builds one public, evidence-linked narrative from the validated rolling scan. */
export function buildDailyStory({ articles = [], intelligence = {}, now = new Date(), windowDays = 30 } = {}) {
  const uniqueArticles = collapseDuplicateArticles(articles, { crossLanguage: true, days: 3 });
  const signals = uniqueArticles.map((article) => ({
    ...analyseArticle(article, article.validation),
    summary: article.summary || "",
  })).filter((article) => article.title);
  if (!signals.length) return null;

  const theme = chooseTheme(signals);
  const hits = SIGNALS.map((signal) => ({ ...signal, count: countHits(signals, signal.terms) }))
    .filter((signal) => signal.count > 0)
    .sort((a, b) => b.count - a.count);
  const topSignals = hits.slice(0, 3);
  const sources = new Set(signals.map((article) => article.sourceId).filter(Boolean));
  const evidence = [...signals]
    .sort((a, b) => b.score - a.score || dateValue(b) - dateValue(a))
    .slice(0, 5)
    .map((article) => ({
      id: article.id,
      url: article.url,
      title: article.title,
      sourceId: article.sourceId,
      publishedAt: article.publishedAt,
      score: article.score,
    }));
  const organisations = findOrganisations(signals);
  const confidence = Math.min(0.95, 0.35 + Math.min(5, sources.size) * 0.09 + Math.min(6, signals.length) * 0.035);
  const signalText = topSignals.length ? topSignals.map((signal) => signal.label).join(", ") : theme.label;
  const orgText = organisations.length ? `The recurring organisations are ${organisations.slice(0, 5).join(", ")}.` : "The pattern spans several market participants rather than one announcement.";
  const trendText = intelligence.trends?.[0]?.summary || `${signals.length} validated signals were collected in the rolling window.`;

  let headline;
  if (theme.category === "telco") headline = topSignals.length >= 2 ? `Greek telecoms: ${topSignals[0].label} meet ${topSignals[1].label}` : "Greek telecoms move from coverage to value creation";
  else if (theme.category === "energy") headline = topSignals.length >= 2 ? `Greek energy: ${topSignals[0].label} shape the next investment cycle` : "Greek energy infrastructure enters a flexibility race";
  else headline = "Greek infrastructure signals converge around capacity and digitalisation";

  const body = [
    `The validated scan found ${signals.length} relevant signals from ${sources.size || 1} source${sources.size === 1 ? "" : "s"} across the last ${windowDays} days. The strongest repeated subjects are ${signalText}.`,
    `${orgText} ${trendText}`,
    `Interpretation: taken together, these signals suggest that the market is moving from isolated projects toward monetising and operating infrastructure as a platform. This is an evidence-based interpretation, not a confirmed forecast.`,
    `What to watch next: new tenders, contracts, regulatory decisions and operator results that confirm whether this theme is translating into sustained investment and revenue.`,
  ];

  return {
    storyDate: dateKey(now),
    generatedAt: new Date(now).toISOString(),
    headline,
    standfirst: `A daily market narrative built from ${signals.length} validated signals and ${sources.size || 1} independent source${sources.size === 1 ? "" : "s"}.`,
    body,
    category: theme.category,
    confidence,
    articleIds: evidence.map((article) => article.id).filter(Boolean),
    evidence,
    metadata: { theme: theme.label, signalLabels: topSignals.map((signal) => signal.label), sourceCount: sources.size, articleCount: signals.length },
  };
}

/**
 * Keeps a successful scan from silently leaving yesterday's story in place
 * when the richer narrative builder cannot assemble a narrative.
 */
export function buildFallbackDailyStory({ articles = [], now = new Date(), windowDays = 30 } = {}) {
  const signals = articles
    .map((article) => ({
      ...analyseArticle(article, article.validation),
      summary: article.summary || "",
    }))
    .filter((article) => article.title && article.url)
    .sort((a, b) => dateValue(b) - dateValue(a) || b.score - a.score)
    .slice(0, 5);
  if (!signals.length) return null;

  const theme = chooseTheme(signals);
  const sources = new Set(signals.map((article) => article.sourceId).filter(Boolean));
  const evidence = signals.map((article) => ({
    id: article.id,
    url: article.url,
    title: article.title,
    sourceId: article.sourceId,
    publishedAt: article.publishedAt,
    score: article.score,
  }));
  const sourceText = sources.size || 1;
  const titles = signals.slice(0, 3).map((article) => article.title).join("; ");

  return {
    storyDate: dateKey(now),
    generatedAt: new Date(now).toISOString(),
    headline: "Greek market wire: fresh infrastructure signals",
    standfirst: `A daily market narrative built from ${signals.length} validated signal${signals.length === 1 ? "" : "s"} and ${sourceText} independent source${sourceText === 1 ? "" : "s"}.`,
    body: [
      `The latest validated scan produced ${signals.length} usable market signal${signals.length === 1 ? "" : "s"} across the last ${windowDays} days.`,
      `Fresh evidence currently includes: ${titles}.`,
      "Interpretation: these signals are published as an evidence-linked market brief while the richer narrative pattern is being assembled.",
      "What to watch next: follow-up announcements, tenders, contracts and regulatory decisions that confirm the direction of travel.",
    ],
    category: theme.category,
    confidence: Math.min(0.75, 0.30 + Math.min(4, sources.size) * 0.08 + Math.min(5, signals.length) * 0.04),
    articleIds: evidence.map((article) => article.id).filter(Boolean),
    evidence,
    metadata: { fallback: true, theme: theme.label, sourceCount: sources.size, articleCount: signals.length },
  };
}

function chooseTheme(signals) {
  const counts = new Map();
  for (const signal of signals) for (const category of signal.categories) counts.set(category, (counts.get(category) || 0) + 1);
  const category = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  return category === "telco" || category === "energy" ? { category, label: category === "telco" ? "telecom market" : "energy infrastructure" } : { category: "infrastructure", label: "infrastructure capacity" };
}

function countHits(signals, terms) {
  return signals.reduce((count, signal) => {
    const text = `${signal.title || ""} ${signal.summary || ""}`.toLocaleLowerCase("el").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return count + (terms.some((term) => hasTerm(text, term)) ? 1 : 0);
  }, 0);
}

function hasTerm(text, term) {
  const value = normalise(term);
  if (value.length <= 2) return new RegExp(`(^|[^\\p{L}\\p{N}])${value}([^\\p{L}\\p{N}]|$)`, "u").test(text);
  return text.includes(value);
}

function findOrganisations(signals) {
  const text = signals.map((signal) => signal.title).join(" ").toLocaleLowerCase("el");
  return ORGANISATIONS.filter((organisation) => text.includes(organisation.toLocaleLowerCase("el")));
}

function normalise(value) { return String(value).toLocaleLowerCase("el").normalize("NFD").replace(/[\u0300-\u036f]/g, ""); }
function dateKey(value) { return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Athens" }).format(new Date(value)); }
function dateValue(article) { const value = Date.parse(article.publishedAt || ""); return Number.isNaN(value) ? 0 : value; }
