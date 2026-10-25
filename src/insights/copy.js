// UI strings for the Insights index/article pages — not editorial content (that lives in
// content/insights/*.md), just the chrome around it. Mirrors src/landing/copy.js's el/en shape.
export const INSIGHTS_COPY = {
  el: {
    lang: "el",
    indexHeading: "Insights",
    minReadLabel(minutes) {
      return minutes === 1 ? "1 λεπτό ανάγνωσης" : `${minutes} λεπτά ανάγνωσης`;
    },
    readMore: "Διαβάστε την ανάλυση →",
    backToIndex: "← Όλα τα Insights",
    langSwitchLabel: "Γλώσσα",
  },
  en: {
    lang: "en",
    indexHeading: "Insights",
    minReadLabel(minutes) {
      return minutes === 1 ? "1 min read" : `${minutes} min read`;
    },
    readMore: "Read the analysis →",
    backToIndex: "← All insights",
    langSwitchLabel: "Language",
  },
};

export function getInsightsCopy(lang) {
  return INSIGHTS_COPY[lang === "en" ? "en" : "el"];
}
