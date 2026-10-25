import { LANDING_ROUTES } from "./routes.js";

const SITE_NAME = "GR Wire";
const OG_LOCALE = { el: "el_GR", en: "en_GB" };

export function siteBase() {
  return process.env.NEXT_PUBLIC_SITE_URL || "https://grwire.com";
}

// routeKey is one of the keys in LANDING_ROUTES.el / .en (e.g. "subscribe", "privacy").
// image, if given, is an absolute URL (build it from siteBase() at the call site).
export function buildLandingMetadata({ lang, routeKey, title, description, image, noindex = false }) {
  const base = siteBase();
  const ownUrl = `${base}${LANDING_ROUTES[lang][routeKey]}`;
  const elUrl = `${base}${LANDING_ROUTES.el[routeKey]}`;
  const enUrl = `${base}${LANDING_ROUTES.en[routeKey]}`;
  const otherLang = lang === "en" ? "el" : "en";

  const metadata = {
    metadataBase: new URL(base),
    title,
    description,
    alternates: {
      canonical: ownUrl,
      languages: { el: elUrl, en: enUrl, "x-default": elUrl },
    },
    openGraph: {
      title,
      description,
      url: ownUrl,
      siteName: SITE_NAME,
      locale: OG_LOCALE[lang],
      alternateLocale: OG_LOCALE[otherLang],
      type: "website",
      ...(image ? { images: [{ url: image }] } : {}),
    },
  };

  if (image) {
    metadata.twitter = { card: "summary_large_image", title, description, images: [image] };
  }
  if (noindex) {
    metadata.robots = { index: false, follow: false };
  }
  return metadata;
}
