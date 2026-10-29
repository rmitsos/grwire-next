// EL is the default language (no prefix); EN routes are prefixed with /en.
export const LANDING_ROUTES = {
  el: {
    home: "/",
    search: "/search",
    subscribe: "/subscribe",
    confirmed: "/subscribe/confirmed",
    unsubscribe: "/unsubscribe",
    privacy: "/privacy",
  },
  en: {
    home: "/en",
    search: "/en/search",
    subscribe: "/en/subscribe",
    confirmed: "/en/subscribe/confirmed",
    unsubscribe: "/en/unsubscribe",
    privacy: "/en/privacy",
  },
};

export function otherLang(lang) {
  return lang === "en" ? "el" : "en";
}

// Section pages (/telco, /energy, ... and /en/telco, ...). The slug is a key of PUBLIC_CATEGORIES.
export function sectionPath(lang, slug) {
  return lang === "en" ? `/en/${slug}` : `/${slug}`;
}
