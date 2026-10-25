import { hashToken } from "./tokens.js";

export const CONSENT_TEXT_VERSION = "2026-10-25-v1";

// landing-copy.md §2, "Consent line (GDPR)" row.
export const CONSENT_TEXT = {
  el:
    "Με την εγγραφή συμφωνείτε να λαμβάνετε το εβδομαδιαίο email του GR Wire. Θα σας στείλουμε πρώτα ένα " +
    "email για να επιβεβαιώσετε τη διεύθυνσή σας. Μπορείτε να διαγραφείτε όποτε θέλετε, με ένα κλικ.",
  en:
    "By subscribing you agree to receive GR Wire's weekly email. We'll first send a message so you can " +
    "confirm your address. You can unsubscribe at any time with one click.",
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CONSENT_VALUES = new Set([true, "on", "yes"]);

export function validateEmail(input) {
  if (typeof input !== "string") return null;
  const normalized = input.trim().toLowerCase();
  if (!normalized || normalized.length > 254) return null;
  if (!EMAIL_PATTERN.test(normalized)) return null;
  return normalized;
}

function resolveLang(lang) {
  return lang === "en" ? "en" : "el";
}

function isConsentGiven(consent) {
  return CONSENT_VALUES.has(consent);
}

export function buildListUnsubscribeHeaders(unsubscribeUrl) {
  return {
    "List-Unsubscribe": `<${unsubscribeUrl}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}

function confirmationEmail(lang, confirmUrl) {
  if (lang === "en") {
    return {
      subject: "Confirm your GR Wire subscription",
      text: `Confirm your subscription to GR Wire's weekly email: ${confirmUrl}`,
      html: `<p>Confirm your subscription to GR Wire's weekly email.</p><p><a href="${confirmUrl}">${confirmUrl}</a></p>`,
    };
  }
  return {
    subject: "Επιβεβαιώστε την εγγραφή σας στο GR Wire",
    text: `Επιβεβαιώστε την εγγραφή σας στο εβδομαδιαίο email του GR Wire: ${confirmUrl}`,
    html: `<p>Επιβεβαιώστε την εγγραφή σας στο εβδομαδιαίο email του GR Wire.</p><p><a href="${confirmUrl}">${confirmUrl}</a></p>`,
  };
}

// deps: { store, provider, siteUrl, now, randomToken }
export function createNewsletterService({ store, provider, siteUrl, now, randomToken }) {
  async function sendConfirmationEmail({ email, lang, confirmToken }) {
    // lang=en lets /api/newsletter/confirm localize its redirect even when the token turns out
    // to be invalid or expired, when a DB lookup can no longer tell us the subscriber's language.
    const langParam = lang === "en" ? "&lang=en" : "";
    const confirmUrl = `${siteUrl}/api/newsletter/confirm?token=${encodeURIComponent(confirmToken)}${langParam}`;
    const { subject, html, text } = confirmationEmail(lang, confirmUrl);
    await provider.send({ to: email, subject, html, text });
  }

  async function subscribe({ email, lang, consent, website, sourcePage }) {
    // Honeypot: a filled-in hidden field means a bot. Pretend success, do nothing.
    if (typeof website === "string" && website.trim() !== "") {
      return { ok: true, status: "check-inbox" };
    }
    if (!isConsentGiven(consent)) {
      return { ok: false, error: "consent-required" };
    }
    const normalizedEmail = validateEmail(email);
    if (!normalizedEmail) {
      return { ok: false, error: "invalid-email" };
    }

    const resolvedLang = resolveLang(lang);
    const confirmToken = randomToken();
    const unsubscribeToken = randomToken();
    const row = await store.upsertPending({
      email: normalizedEmail,
      lang: resolvedLang,
      consentTextVersion: CONSENT_TEXT_VERSION,
      sourcePage: sourcePage || null,
      confirmTokenHash: hashToken(confirmToken),
      unsubscribeTokenHash: hashToken(unsubscribeToken),
    });

    // Already confirmed: leave the row untouched and send nothing. Same response either way,
    // so this endpoint can't be used to probe which addresses are already on the list.
    if (row.status !== "confirmed") {
      await sendConfirmationEmail({ email: normalizedEmail, lang: row.lang, confirmToken });
    }
    return { ok: true, status: "check-inbox" };
  }

  async function confirm(token) {
    if (typeof token !== "string" || !token) return { ok: false, error: "invalid-or-expired" };
    const row = await store.confirmByTokenHash(hashToken(token), { maxAgeDays: 7 });
    return row ? { ok: true, lang: row.lang } : { ok: false, error: "invalid-or-expired" };
  }

  async function unsubscribe(token) {
    if (typeof token !== "string" || !token) return { ok: false, error: "invalid" };
    const result = await store.unsubscribeByTokenHash(hashToken(token));
    return result?.found ? { ok: true } : { ok: false, error: "invalid" };
  }

  // Raw `unsubscribeToken` must have just been issued for this subscriber (tokens are stored
  // hashed, so the raw value can't be recovered later) — see store.rotateUnsubscribeToken.
  async function sendToSubscriber({ subscriber, unsubscribeToken, subject, html, text }) {
    if (subscriber.status !== "confirmed") {
      throw new Error("Cannot send to a subscriber who has not confirmed");
    }
    // RFC 8058 requires the List-Unsubscribe target to accept a POST, so the header points at
    // the API route. The visible link in the email body points at the human-readable page instead
    // (it only accepts a button click there, not a bare POST from a mail client).
    const apiUnsubscribeUrl = `${siteUrl}/api/newsletter/unsubscribe?token=${encodeURIComponent(unsubscribeToken)}`;
    const isEn = subscriber.lang === "en";
    const pageUnsubscribeUrl = `${siteUrl}${isEn ? "/en/unsubscribe" : "/unsubscribe"}?token=${encodeURIComponent(unsubscribeToken)}`;
    const label = isEn ? "Unsubscribe" : "Διαγραφή";
    const headers = buildListUnsubscribeHeaders(apiUnsubscribeUrl);
    return provider.send({
      to: subscriber.email,
      subject,
      html: `${html}<p><a href="${pageUnsubscribeUrl}">${label}</a></p>`,
      text: `${text}\n\n${label}: ${pageUnsubscribeUrl}`,
      headers,
    });
  }

  return { subscribe, confirm, unsubscribe, buildListUnsubscribeHeaders, sendToSubscriber };
}
