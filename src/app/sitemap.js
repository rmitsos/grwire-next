import { LANDING_ROUTES } from "../landing/routes.js";
import { listInsights, insightPath, insightsIndexPath } from "../insights/content.js";

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

export default function sitemap() {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "https://grwire.com";
  const pages = ["", "/deals-companies", "/telco", "/energy", "/infrastructure", "/search"].map((path) => ({
    url: `${base}${path}`,
    changeFrequency: "daily",
    priority: path ? 0.8 : 1,
  }));

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
