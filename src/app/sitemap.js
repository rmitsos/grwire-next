import { LANDING_ROUTES, sectionPath } from "../landing/routes.js";
import { listInsights, insightPath, insightsIndexPath } from "../insights/content.js";
import { getNavVisibility } from "../public-data.js";

// Pure (no fs): takes already-parsed insight lists so draft-exclusion logic can be unit-tested
// with synthetic fixtures. An index is only indexed/sitemapped while at least one of its listed
// articles is non-draft; an article is sitemapped only while it itself is non-draft.
export function buildInsightSitemapEntries(base, elInsights, enInsights) {
  const insightsAlternates = {
    languages: {
      el: `${base}${insightsIndexPath("el")}`,
      en: `${base}${insightsIndexPath("en")}`,
    },
  };

  const indexEntries = [];
  if (elInsights.some((insight) => !insight.draft)) {
    indexEntries.push({
      url: `${base}${insightsIndexPath("el")}`,
      changeFrequency: "weekly",
      priority: 0.7,
      alternates: insightsAlternates,
    });
  }
  if (enInsights.some((insight) => !insight.draft)) {
    indexEntries.push({
      url: `${base}${insightsIndexPath("en")}`,
      changeFrequency: "weekly",
      priority: 0.7,
      alternates: insightsAlternates,
    });
  }

  const articleEntries = elInsights.flatMap((elInsight) => {
    const enInsight = enInsights.find((insight) => insight.slug === elInsight.slug);
    const elUrl = `${base}${insightPath(elInsight.slug, "el")}`;
    const enUrl = `${base}${insightPath(elInsight.slug, "en")}`;
    const alternates = { languages: { el: elUrl, en: enUrl } };
    const entries = [];
    if (!elInsight.draft) entries.push({ url: elUrl, changeFrequency: "monthly", priority: 0.6, alternates });
    if (enInsight && !enInsight.draft) {
      entries.push({ url: enUrl, changeFrequency: "monthly", priority: 0.6, alternates });
    }
    return entries;
  });

  return [...indexEntries, ...articleEntries];
}

// Pure: the wire pages in both languages. /tenders and /regulators (and their /en twins) are
// left out until their section has >=3 items in the last 30 days (the pages still resolve,
// they're just not advertised). Tenders stays before Regulators, per the nav order.
export function buildPublicSitemapEntries(base, navVisibility) {
  const sections = ["deals", "telco", "energy", "infrastructure"];
  if (navVisibility.tenders?.shown) sections.push("tenders");
  if (navVisibility.regulators?.shown) sections.push("regulators");
  const pagePairs = [
    { el: LANDING_ROUTES.el.home, en: LANDING_ROUTES.en.home, priority: 1 },
    ...sections.map((slug) => ({ el: sectionPath("el", slug), en: sectionPath("en", slug), priority: 0.8 })),
    { el: LANDING_ROUTES.el.search, en: LANDING_ROUTES.en.search, priority: 0.8 },
  ];
  return pagePairs.flatMap((pair) => {
    const alternates = { languages: { el: `${base}${pair.el}`, en: `${base}${pair.en}` } };
    return ["el", "en"].map((lang) => ({
      url: `${base}${pair[lang]}`,
      changeFrequency: "daily",
      priority: pair.priority,
      alternates,
    }));
  });
}

export default async function sitemap() {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "https://grwire.com";
  const pages = buildPublicSitemapEntries(base, await getNavVisibility());

  const subscribe = {
    url: `${base}${LANDING_ROUTES.el.subscribe}`,
    changeFrequency: "weekly",
    priority: 0.9,
    alternates: {
      languages: {
        el: `${base}${LANDING_ROUTES.el.subscribe}`,
        en: `${base}${LANDING_ROUTES.en.subscribe}`,
      },
    },
  };
  const subscribeEn = {
    url: `${base}${LANDING_ROUTES.en.subscribe}`,
    changeFrequency: "weekly",
    priority: 0.9,
    alternates: {
      languages: {
        el: `${base}${LANDING_ROUTES.el.subscribe}`,
        en: `${base}${LANDING_ROUTES.en.subscribe}`,
      },
    },
  };

  const insightEntries = buildInsightSitemapEntries(base, listInsights("el"), listInsights("en"));

  return [...pages, subscribe, subscribeEn, ...insightEntries];
}
