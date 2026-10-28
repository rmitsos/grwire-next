// EL is the default language (no prefix); EN routes are prefixed with /en.
export const LANDING_ROUTES = {
  el: {
    subscribe: "/subscribe",
    confirmed: "/subscribe/confirmed",
    unsubscribe: "/unsubscribe",
    privacy: "/privacy",
  },
  en: {
    subscribe: "/en/subscribe",
    confirmed: "/en/subscribe/confirmed",
    unsubscribe: "/en/unsubscribe",
    privacy: "/en/privacy",
  },
};

export function otherLang(lang) {
  return lang === "en" ? "el" : "en";
}
