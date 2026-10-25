import { getNewsletterConfig } from "../../../../newsletter/config.js";
import { createNewsletterRuntime } from "../../../../newsletter/runtime.js";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const url = new URL(request.url);
  // The confirmation link carries ?lang=en for EN subscribers (see service.js
  // sendConfirmationEmail) purely so a failed/expired token can still redirect to the EN
  // subscribe page — a lookup that failed can't tell us the subscriber's language itself.
  const requestLang = url.searchParams.get("lang") === "en" ? "en" : null;

  const config = getNewsletterConfig();
  if (!config.enabled) {
    console.error(`newsletter disabled: missing ${config.missing.join(", ")}`);
    return Response.redirect(subscribeUrl(request, "unavailable", requestLang), 303);
  }

  const token = url.searchParams.get("token");
  const runtime = createNewsletterRuntime();
  const result = await runtime.service.confirm(token);

  if (!result.ok) {
    return Response.redirect(subscribeUrl(request, "invalid-link", requestLang), 303);
  }
  const confirmedPath = result.lang === "en" ? "/en/subscribe/confirmed" : "/subscribe/confirmed";
  return Response.redirect(new URL(confirmedPath, request.url), 303);
}

function subscribeUrl(request, status, lang) {
  const path = lang === "en" ? "/en/subscribe" : "/subscribe";
  const url = new URL(path, request.url);
  url.searchParams.set("status", status);
  return url;
}
