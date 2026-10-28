import { LandingHeader } from "@/components/landing/LandingHeader";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { LANDING_ROUTES } from "@/landing/routes";

// The Greek-first landing shell around every public wire page. elHref/enHref are the same page in
// each language, so the ΕΛ/EN switch lands on the equivalent page, not on /subscribe.
export function PublicShell({ lang, elHref, enHref, children }) {
  return (
    <>
      <LandingHeader
        lang={lang}
        elHref={elHref}
        enHref={enHref}
        subscribeHref={LANDING_ROUTES[lang].subscribe}
      />
      <main className="pub-main">{children}</main>
      <LandingFooter lang={lang} elHref={elHref} enHref={enHref} />
    </>
  );
}
