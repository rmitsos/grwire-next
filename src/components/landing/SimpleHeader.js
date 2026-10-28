import { getLandingCopy } from "@/landing/copy";
import { LANDING_ROUTES } from "@/landing/routes";
import { LangToggle } from "@/components/landing/LandingHeader";

// Minimal top bar for privacy / unsubscribe / confirmed pages — no section nav, since those
// pages aren't about one sector. The lang toggle links to the same page in the other language.
export function SimpleHeader({ lang, routeKey }) {
  const copy = getLandingCopy(lang).header;
  return (
    <header className="simple-header">
      <div className="wrap">
        <a className="wordmark" href={LANDING_ROUTES[lang].subscribe}>
          {copy.wordmark}
          <i />
        </a>
        <LangToggle lang={lang} routeKey={routeKey} />
      </div>
    </header>
  );
}
