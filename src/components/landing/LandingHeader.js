import Link from "next/link";
import { getLandingCopy, NAV_SECTIONS } from "@/landing/copy";
import { LANDING_ROUTES, sectionPath } from "@/landing/routes";
import { insightsIndexPath } from "@/insights/content";
import { getNavVisibility } from "@/public-data";

// elHref/enHref/subscribeHref let a page override the default subscribe-page hrefs — every page
// passes the same page in the other language for its ΕΛ/EN switch, and its subscribe button goes
// to the subscribe page (only the subscribe page itself has a hero form to jump to, "#subscribe").
//
// /tenders and /regulators stay out of the nav until their section has >=3 items (see
// getNavVisibility); the pages themselves still resolve. Section links are language-aware
// (/telco in EL, /en/telco in EN).
export async function LandingHeader({ lang, elHref, enHref, subscribeHref }) {
  const copy = getLandingCopy(lang).header;
  const navVisibility = await getNavVisibility();
  const sections = NAV_SECTIONS.filter((section) => navVisibility[section.slug]?.shown !== false);
  return (
    <header className="site-header">
      <div className="wrap">
        <a className="wordmark" href={LANDING_ROUTES[lang].home}>
          {copy.wordmark}
          <i />
        </a>
        <nav className="nav-sections" aria-label={lang === "el" ? "Ενότητες" : "Sections"}>
          {sections.map((section) => (
            <Link key={section.slug} href={sectionPath(lang, section.slug)} className={section.primary ? "primary" : undefined}>
              {copy.navSections[section.slug][lang]}
            </Link>
          ))}
          <Link href={insightsIndexPath(lang)}>{copy.insightsLabel}</Link>
          <Link href={LANDING_ROUTES[lang].search}>{copy.searchLabel}</Link>
        </nav>
        <LangToggle lang={lang} routeKey="subscribe" elHref={elHref} enHref={enHref} />
        <a className="btn small" href={subscribeHref ?? "#subscribe"}>
          {copy.subscribeButton}
        </a>
      </div>
    </header>
  );
}

export function LangToggle({ lang, routeKey, elHref, enHref }) {
  const el = elHref ?? LANDING_ROUTES.el[routeKey];
  const en = enHref ?? LANDING_ROUTES.en[routeKey];
  return (
    <span className="lang-toggle">
      <a href={el} hrefLang="el" className={lang === "el" ? "active" : undefined}>
        ΕΛ
      </a>
      <a href={en} hrefLang="en" className={lang === "en" ? "active" : undefined}>
        EN
      </a>
    </span>
  );
}
