"use client";

import { useEffect, useRef, useState } from "react";
import { getLandingCopy } from "@/landing/copy";
import { LANDING_ROUTES } from "@/landing/routes";
import { validationMessage } from "@/landing/form-validation";

// How long the button stays disabled after a submit before it is given back (the browser has
// normally navigated away long before that; this is for a request that never left, e.g. offline).
const SUBMIT_LOCK_MS = 10000;

// A plain HTML form that posts to /api/newsletter/subscribe, so it works without JS. With JS it
// also (a) disables the button once submitted, so a double click sends one request, and (b) shows
// the browser's validation bubbles in the page language instead of the browser's own.
// See src/app/api/newsletter/subscribe/route.js for handling.
export function SubscribeForm({ lang, sourcePage, idSuffix }) {
  const copy = getLandingCopy(lang).subscribeForm;
  const emailId = `email-${idSuffix}`;
  const consentId = `consent-${idSuffix}`;
  const submitted = useRef(false);
  const timer = useRef(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Coming back with the browser's Back button restores the page from cache: unlock the form.
    const unlock = (event) => {
      if (!event.persisted) return;
      submitted.current = false;
      setBusy(false);
    };
    window.addEventListener("pageshow", unlock);
    return () => {
      window.removeEventListener("pageshow", unlock);
      clearTimeout(timer.current);
    };
  }, []);

  function onSubmit(event) {
    if (submitted.current) {
      event.preventDefault();
      return;
    }
    submitted.current = true;
    setBusy(true);
    timer.current = setTimeout(() => {
      submitted.current = false;
      setBusy(false);
    }, SUBMIT_LOCK_MS);
  }

  const showMessage = (field) => (event) => {
    event.currentTarget.setCustomValidity(validationMessage(field, event.currentTarget.validity, copy));
  };
  const clearMessage = (event) => event.currentTarget.setCustomValidity("");

  return (
    <form className="sub-form" action="/api/newsletter/subscribe" method="post" onSubmit={onSubmit}>
      <label className="f" htmlFor={emailId}>
        {copy.fieldLabel}
      </label>
      <div className="form-row">
        <input
          id={emailId}
          type="email"
          name="email"
          placeholder={copy.placeholder}
          autoComplete="email"
          required
          onInvalid={showMessage("email")}
          onInput={clearMessage}
        />
        <button className="btn" type="submit" disabled={busy} aria-busy={busy}>
          {copy.button}
        </button>
      </div>
      <input type="hidden" name="lang" value={lang} />
      <input type="hidden" name="sourcePage" value={sourcePage} />
      {/* Honeypot: real users never see or fill this in; see src/newsletter/service.js#subscribe. */}
      <input className="hp" type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" />
      <p className="free-note">{copy.freeNote}</p>
      <p className="consent consent-field">
        <input
          id={consentId}
          type="checkbox"
          name="consent"
          required
          onInvalid={showMessage("consent")}
          onChange={clearMessage}
        />
        <label htmlFor={consentId}>
          {copy.consentText} <a href={LANDING_ROUTES[lang].privacy}>{copy.privacyLinkLabel}</a>
        </label>
      </p>
    </form>
  );
}
