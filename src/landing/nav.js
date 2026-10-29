import { getLandingCopy, NAV_SECTIONS } from "./copy.js";
import { LANDING_ROUTES, sectionPath } from "./routes.js";
import { insightsIndexPath } from "../insights/content.js";

// The tabs of the top nav, with the current page marked. `active` is the tab the page belongs to:
// a section slug ("telco", "energy", ...), "insights" or "search". Home, subscribe and the other
// pages that are not a tab pass nothing, so no tab is marked there. Pure, so it is unit-tested.
//
// /tenders and /regulators stay out of the nav until their section has >=3 items (navVisibility,
// see getNavVisibility); the pages themselves still resolve.
export function buildNavItems({ lang, navVisibility = {}, active = null }) {
  const copy = getLandingCopy(lang).header;
  const sections = NAV_SECTIONS.filter((section) => navVisibility[section.slug]?.shown !== false);
  const items = [
    ...sections.map((section) => ({
      key: section.slug,
      href: sectionPath(lang, section.slug),
      label: copy.navSections[section.slug][lang],
      color: section.color,
    })),
    { key: "insights", href: insightsIndexPath(lang), label: copy.insightsLabel, color: "var(--signal)" },
    { key: "search", href: LANDING_ROUTES[lang].search, label: copy.searchLabel, color: "var(--ink)" },
  ];
  return items.map((item) => ({ ...item, current: item.key === active }));
}
