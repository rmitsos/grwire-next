import Link from "next/link";
import { getLandingCopy } from "@/landing/copy";
import { LANDING_ROUTES } from "@/landing/routes";
import { buildNavItems } from "@/landing/nav";
import { NavScrollActive } from "@/components/landing/NavScrollActive";
import { getNavVisibility } from "@/public-data";

// elHref/enHref/subscribeHref let a page override the default subscribe-page hrefs — every page
// passes the same page in the other language for its ΕΛ/EN switch, and its subscribe button goes
// to the subscribe page (only the subscribe page itself has a hero form to jump to, "#subscribe").
//
// `active` names the tab the page belongs to (a section slug, "insights" or "search"); that tab
// is drawn bold with its section dot and carries aria-current="page". Omit it on the homepage and
// other pages that are not a tab: then no tab is marked, and the wordmark is the current page on
// the homepage (`home`).
//
// /tenders and /regulators stay out of the nav until their section has >=3 items (see
// getNavVisibility); the pages themselves still resolve. Section links are language-aware
// (/telco in EL, /en/telco in EN).
//
// The header is sticky (see landing.css), so every page that uses it keeps the nav in view.
export async function LandingHeader({ lang, elHref, enHref, subscribeHref, active = null, home = false }) {
  const copy = getLandingCopy(lang).header;
  const navVisibility = await getNavVisibility();
  const items = buildNavItems({ lang, navVisibility, active });
  return (
    <header className="site-header">
      <div className="wrap">
        <a className="wordmark" href={LANDING_ROUTES[lang].home} aria-current={home ? "page" : undefined}>
          {copy.wordmark}
          <i />
        </a>
        <nav className="nav-sections" aria-label={lang === "el" ? "Ενότητες" : "Sections"}>
          {items.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              aria-current={item.current ? "page" : undefined}
              className={item.current ? "current" : undefined}
              style={item.current ? { "--tab": item.color } : undefined}
            >
              {item.label}
            </Link>
          ))}
          <NavScrollActive />
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
