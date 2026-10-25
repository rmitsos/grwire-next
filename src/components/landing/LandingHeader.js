import Link from "next/link";
import { getLandingCopy, NAV_SECTIONS } from "@/landing/copy";
import { LANDING_ROUTES } from "@/landing/routes";

// elHref/enHref/subscribeHref let a page override the default subscribe-page hrefs — e.g. an
// insight article wants its ΕΛ/EN switch to land on the same slug in the other language, and its
// subscribe button to go to the subscribe page rather than "#subscribe" (there's no hero form on
// that page to jump to).
export function LandingHeader({ lang, elHref, enHref, subscribeHref }) {
  const copy = getLandingCopy(lang).header;
  return (
    <header className="site-header">
      <div className="wrap">
        <a className="wordmark" href={LANDING_ROUTES[lang].subscribe}>
          {copy.wordmark}
          <i />
        </a>
        <nav className="nav-sections" aria-label={lang === "el" ? "Ενότητες" : "Sections"}>
          {NAV_SECTIONS.map((section) => (
            <Link key={section.slug} href={section.path} className={section.primary ? "primary" : undefined}>
              {copy.navSections[section.slug][lang]}
            </Link>
          ))}
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
