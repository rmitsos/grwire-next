import { LANDING_ROUTES } from "@/landing/routes";

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

  return [...pages, subscribe, subscribeEn];
}
