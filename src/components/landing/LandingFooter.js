import Link from "next/link";
import { getLandingCopy, NAV_SECTIONS } from "@/landing/copy";
import { LANDING_ROUTES } from "@/landing/routes";
import { LangToggle } from "@/components/landing/LandingHeader";

export function LandingFooter({ lang }) {
  const copy = getLandingCopy(lang).footer;
  return (
    <footer className="site-footer">
      <div className="wrap">
        <div>
          <a className="wordmark" href={LANDING_ROUTES[lang].subscribe}>
            {copy.wordmark}
            <i />
          </a>
          <p style={{ margin: 0 }}>{copy.tagline}</p>
        </div>
        <ul>
          {NAV_SECTIONS.map((section) => (
            <li key={section.slug}>
              <Link href={section.path} style={{ "--c": section.color }}>
                <span className="section-dot" />
                {getLandingCopy(lang).header.navSections[section.slug][lang]}
              </Link>
            </li>
          ))}
        </ul>
        <ul>
          <li>
            <Link href={LANDING_ROUTES[lang].privacy}>{copy.privacyLabel}</Link>
          </li>
          <li className="footer-lang">
            <LangToggle lang={lang} routeKey="subscribe" />
          </li>
        </ul>
        <p className="fine">{copy.fine}</p>
      </div>
    </footer>
  );
}
