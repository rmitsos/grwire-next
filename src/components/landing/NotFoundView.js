import { getLandingCopy } from "@/landing/copy";
import { LANDING_ROUTES } from "@/landing/routes";
import { LangToggle } from "@/components/landing/LandingHeader";
import { SimpleHeader } from "@/components/landing/SimpleHeader";

// The branded 404 in one language: GR Wire header and footer, no data fetching, so it renders for
// any URL even when the database is down.
export function NotFoundView({ lang }) {
  const copy = getLandingCopy(lang);
  const text = copy.notFound;
  return (
    <>
      <SimpleHeader lang={lang} routeKey="home" />
      <main className="wrap simple-page">
        <h1>{text.title}</h1>
        <p>{text.body}</p>
        <a className="back-link" href={LANDING_ROUTES[lang].home}>
          {text.backLink}
        </a>
      </main>
      <footer className="site-footer">
        <div className="wrap">
          <div>
            <a className="wordmark" href={LANDING_ROUTES[lang].home}>
              {copy.footer.wordmark}
              <i />
            </a>
            <p style={{ margin: 0 }}>{copy.footer.tagline}</p>
          </div>
          <ul>
            <li>
              <a href={LANDING_ROUTES[lang].privacy}>{copy.footer.privacyLabel}</a>
            </li>
            <li className="footer-lang">
              <LangToggle lang={lang} routeKey="home" />
            </li>
          </ul>
          <p className="fine">{copy.footer.fine}</p>
        </div>
      </footer>
    </>
  );
}
