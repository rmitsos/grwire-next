import { hashToken } from "./tokens.js";
import { confirmationEmail, welcomeEmail, digestEmail } from "./emails.js";

export const CONSENT_TEXT_VERSION = "2026-10-29-v2";

// subscribe-copy-v2.md, "Consent line" row (29 Oct 2026). The privacy-policy link is rendered next to it.
export const CONSENT_TEXT = {
  el:
    "Με την εγγραφή συμφωνείτε να λαμβάνετε το ημερήσιο email του GR Wire από την Tareno Systems. Θα σας στείλουμε " +
    "πρώτα ένα email για να επιβεβαιώσετε τη διεύθυνσή σας. Μπορείτε να διαγραφείτε όποτε θέλετε, με ένα κλικ.",
  en:
    "By subscribing you agree to receive GR Wire's daily email from Tareno Systems. We'll first send a message " +
    "so you can confirm your address. You can unsubscribe at any time with one click.",
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

// deps: { store, provider, siteUrl, now, randomToken }
export function createNewsletterService({ store, provider, siteUrl, now, randomToken, unsubscribeTokenFor = null }) {
  // The API URL goes in the List-Unsubscribe header (RFC 8058 needs a POST target); the visible
  // footer link points at the human page, which only unsubscribes on a button click.
  function unsubscribeLinks(email, lang, token) {
    const isEn = lang === "en";
    const encoded = encodeURIComponent(token);
    return {
      apiUrl: `${siteUrl}/api/newsletter/unsubscribe?token=${encoded}`,
      pageUrl: `${siteUrl}${isEn ? "/en/unsubscribe" : "/unsubscribe"}?token=${encoded}`,
    };
  }

  async function sendConfirmationEmail({ email, lang, confirmToken, unsubscribeToken }) {
    // lang=en lets /api/newsletter/confirm localize its redirect even when the token turns out
    // to be invalid or expired, when a DB lookup can no longer tell us the subscriber's language.
    const langParam = lang === "en" ? "&lang=en" : "&lang=el";
    const confirmUrl = `${siteUrl}/api/newsletter/confirm?token=${encodeURIComponent(confirmToken)}${langParam}`;
    const links = unsubscribeLinks(email, lang, unsubscribeToken);
    const { subject, html, text } = confirmationEmail({ lang, confirmUrl, unsubscribeUrl: links.pageUrl, siteUrl });
    await provider.send({ to: email, subject, html, text, headers: buildListUnsubscribeHeaders(links.apiUrl), tag: "confirmation" });
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
    const unsubscribeToken = unsubscribeTokenFor ? unsubscribeTokenFor(normalizedEmail) : randomToken();
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
    // issued === false: the same pending address was submitted again within the 2-minute window
    // (double click, retry). The first email and its link stay valid, so no second one goes out.
    if (row.status !== "confirmed" && row.issued !== false) {
      await sendConfirmationEmail({ email: normalizedEmail, lang: row.lang, confirmToken, unsubscribeToken });
    }
    return { ok: true, status: "check-inbox" };
  }

  async function confirm(token) {
    if (typeof token !== "string" || !token) return { ok: false, error: "invalid-or-expired" };
    const tokenHash = hashToken(token);
    const row = await store.confirmByTokenHash(tokenHash, { maxAgeDays: 7 });
    if (!row) {
      // Not accepted: tell "already confirmed" (a re-click) from an invalid or expired link. `lang`
      // is the subscriber's language when the token is known, so the next page matches it.
      const known = store.findByConfirmTokenHash ? await store.findByConfirmTokenHash(tokenHash) : null;
      const lang = known?.lang === "en" ? "en" : known?.lang === "el" ? "el" : null;
      if (known?.status === "confirmed") return { ok: true, already: true, lang: lang || "el" };
      return { ok: false, error: "invalid-or-expired", lang };
    }
    // Welcome email, once, on confirmation. The confirmation itself never fails because of it.
    if (unsubscribeTokenFor) {
      try {
        const links = unsubscribeLinks(row.email, row.lang, unsubscribeTokenFor(row.email));
        const { subject, html, text } = welcomeEmail({ lang: row.lang, unsubscribeUrl: links.pageUrl, siteUrl });
        await provider.send({ to: row.email, subject, html, text, headers: buildListUnsubscribeHeaders(links.apiUrl), tag: "welcome" });
      } catch (error) {
        console.error("[newsletter] welcome email failed:", error?.message || error);
      }
    }
    return { ok: true, lang: row.lang };
  }

  async function unsubscribe(token) {
    if (typeof token !== "string" || !token) return { ok: false, error: "invalid" };
    const result = await store.unsubscribeByTokenHash(hashToken(token));
    if (!result?.found) return { ok: false, error: "invalid" };
    return { ok: true, already: Boolean(result.already) };
  }

  // Read-only, for the unsubscribe page: 'active' (show the button), 'unsubscribed' or 'invalid'.
  async function unsubscribeState(token) {
    if (typeof token !== "string" || !token || !store.unsubscribeStateByTokenHash) return "invalid";
    return store.unsubscribeStateByTokenHash(hashToken(token));
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

  // One daily email. Throws on a provider error so the caller can mark the send as failed.
  async function sendDigest({ subscriber, stories, comment, date }) {
    if (subscriber.status !== "confirmed") throw new Error("Cannot send to a subscriber who has not confirmed");
    if (!unsubscribeTokenFor) throw new Error("unsubscribeTokenFor is required to send the digest");
    const links = unsubscribeLinks(subscriber.email, subscriber.lang, unsubscribeTokenFor(subscriber.email));
    const { subject, html, text } = digestEmail({
      lang: subscriber.lang, stories, comment, unsubscribeUrl: links.pageUrl, siteUrl, date,
    });
    return provider.send({ to: subscriber.email, subject, html, text, headers: buildListUnsubscribeHeaders(links.apiUrl), tag: "digest" });
  }

  return { subscribe, confirm, unsubscribe, unsubscribeState, buildListUnsubscribeHeaders, sendToSubscriber, sendDigest };
}
