import { getNewsletterConfig } from "../../../../newsletter/config.js";
import { createNewsletterRuntime } from "../../../../newsletter/runtime.js";

export const dynamic = "force-dynamic";

// Which language the landing page after a confirm link should be in: the link's own ?lang=, else
// the subscriber's stored language (known tokens), else the browser's Accept-Language, else Greek.
export function pickConfirmLang({ paramLang, subscriberLang, acceptLanguage }) {
  if (paramLang === "en" || paramLang === "el") return paramLang;
  if (subscriberLang === "en" || subscriberLang === "el") return subscriberLang;
  const first = String(acceptLanguage || "").split(",")[0].trim().toLowerCase();
  return first.startsWith("en") ? "en" : "el";
}

export async function GET(request) {
  const url = new URL(request.url);
  // Confirmation links carry ?lang= (see service.js sendConfirmationEmail) so a failed or expired token
  // still lands on the page in the subscriber's language.
  const paramLang = url.searchParams.get("lang");
  const acceptLanguage = request.headers.get("accept-language");

  const config = getNewsletterConfig();
  if (!config.enabled) {
    console.error(`newsletter disabled: missing ${config.missing.join(", ")}`);
    return Response.redirect(subscribeUrl(request, "unavailable", pickConfirmLang({ paramLang, acceptLanguage })), 303);
  }

  const token = url.searchParams.get("token");
  const runtime = createNewsletterRuntime();
  const result = await runtime.service.confirm(token);
  const lang = pickConfirmLang({ paramLang, subscriberLang: result.lang, acceptLanguage });

  if (!result.ok) {
    return Response.redirect(subscribeUrl(request, "invalid-link", lang), 303);
  }
  if (result.already) {
    // A second click on the same link: friendly message, not an error.
    return Response.redirect(subscribeUrl(request, "already-confirmed", lang), 303);
  }
  const confirmedPath = lang === "en" ? "/en/subscribe/confirmed" : "/subscribe/confirmed";
  return Response.redirect(new URL(confirmedPath, request.url), 303);
}

function subscribeUrl(request, status, lang) {
  const path = lang === "en" ? "/en/subscribe" : "/subscribe";
  const url = new URL(path, request.url);
  url.searchParams.set("status", status);
  return url;
}
