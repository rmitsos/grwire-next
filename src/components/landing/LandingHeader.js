import Link from "next/link";
import { getLandingCopy, NAV_SECTIONS } from "@/landing/copy";
import { LANDING_ROUTES } from "@/landing/routes";

export function LandingHeader({ lang }) {
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
        <LangToggle lang={lang} routeKey="subscribe" />
        <a className="btn small" href="#subscribe">
          {copy.subscribeButton}
        </a>
      </div>
    </header>
  );
}

export function LangToggle({ lang, routeKey }) {
  return (
    <span className="lang-toggle">
      <a href={LANDING_ROUTES.el[routeKey]} hrefLang="el" className={lang === "el" ? "active" : undefined}>
        ΕΛ
      </a>
      <a href={LANDING_ROUTES.en[routeKey]} hrefLang="en" className={lang === "en" ? "active" : undefined}>
        EN
      </a>
    </span>
  );
}
