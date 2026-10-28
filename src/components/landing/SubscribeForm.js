import { getLandingCopy } from "@/landing/copy";
import { LANDING_ROUTES } from "@/landing/routes";

// Plain HTML form, no JS required. See src/app/api/newsletter/subscribe/route.js for handling.
export function SubscribeForm({ lang, sourcePage, idSuffix }) {
  const copy = getLandingCopy(lang).subscribeForm;
  const emailId = `email-${idSuffix}`;
  const consentId = `consent-${idSuffix}`;

  return (
    <form className="sub-form" action="/api/newsletter/subscribe" method="post">
      <label className="f" htmlFor={emailId}>
        {copy.fieldLabel}
      </label>
      <div className="form-row">
        <input id={emailId} type="email" name="email" placeholder={copy.placeholder} autoComplete="email" required />
        <button className="btn" type="submit">
          {copy.button}
        </button>
      </div>
      <input type="hidden" name="lang" value={lang} />
      <input type="hidden" name="sourcePage" value={sourcePage} />
      {/* Honeypot: real users never see or fill this in; see src/newsletter/service.js#subscribe. */}
      <input className="hp" type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" />
      <p className="free-note">{copy.freeNote}</p>
      <p className="consent consent-field">
        <input id={consentId} type="checkbox" name="consent" required />
        <label htmlFor={consentId}>
          {copy.consentText} <a href={LANDING_ROUTES[lang].privacy}>{copy.privacyLinkLabel}</a>
        </label>
      </p>
    </form>
  );
}
