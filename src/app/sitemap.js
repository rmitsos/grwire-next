import { LANDING_ROUTES } from "../landing/routes.js";
import { listInsights, insightPath, insightsIndexPath } from "../insights/content.js";

export default function sitemap() {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "https://grwire.com";
  const pages = ["", "/finance", "/telco", "/energy", "/infrastructure", "/search"].map((path) => ({
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

  const insightsAlternates = {
    languages: {
      el: `${base}${insightsIndexPath("el")}`,
      en: `${base}${insightsIndexPath("en")}`,
    },
  };
  const insightsIndex = {
    url: `${base}${insightsIndexPath("el")}`,
    changeFrequency: "weekly",
    priority: 0.7,
    alternates: insightsAlternates,
  };
  const insightsIndexEn = {
    url: `${base}${insightsIndexPath("en")}`,
    changeFrequency: "weekly",
    priority: 0.7,
    alternates: insightsAlternates,
  };

  const articles = listInsights("el").flatMap((insight) => {
    const elUrl = `${base}${insightPath(insight.slug, "el")}`;
    const enUrl = `${base}${insightPath(insight.slug, "en")}`;
    const alternates = { languages: { el: elUrl, en: enUrl } };
    return [
      { url: elUrl, changeFrequency: "monthly", priority: 0.6, alternates },
      { url: enUrl, changeFrequency: "monthly", priority: 0.6, alternates },
    ];
  });

  return [...pages, subscribe, subscribeEn, insightsIndex, insightsIndexEn, ...articles];
}
