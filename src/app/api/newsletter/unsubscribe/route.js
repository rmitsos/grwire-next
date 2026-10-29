import { getNewsletterConfig } from "../../../../newsletter/config.js";
import { createNewsletterRuntime } from "../../../../newsletter/runtime.js";

export const dynamic = "force-dynamic";

// Mail scanners prefetch GET links, so GET must never unsubscribe. Send the human to a page
// with a button that POSTs instead.
export async function GET(request) {
  const params = new URL(request.url).searchParams;
  const token = params.get("token") || "";
  const path = params.get("lang") === "en" ? "/en/unsubscribe" : "/unsubscribe";
  const url = new URL(path, request.url);
  if (token) url.searchParams.set("token", token);
  return Response.redirect(url, 303);
}

// True for an RFC 8058 one-click POST (exact body mail clients send for List-Unsubscribe-Post).
// Anything else — including our own /unsubscribe page's plain form post, body "lang=el"/"lang=en" —
// is a browser request, which gets a 303 to a human-readable confirmation page instead.
export function isOneClickUnsubscribe(rawBody) {
  return rawBody.trim() === "List-Unsubscribe=One-Click";
}

export function unsubscribeStatus(result) {
  if (!result?.ok) return "invalid-unsubscribe";
  return result.already ? "already-unsubscribed" : "done";
}

export function unsubscribeRedirectPath(rawBody) {
  return new URLSearchParams(rawBody).get("lang") === "en" ? "/en/unsubscribe" : "/unsubscribe";
}

// Two kinds of POST land here, both with the token in the query string:
//  - RFC 8058 one-click: mail clients POST body "List-Unsubscribe=One-Click" and expect a plain
//    200 "Unsubscribed" (idempotent, and this never reveals whether the token was valid).
//  - Our own /unsubscribe page: a plain HTML form post (body is just "lang=el" or "lang=en", not
//    the RFC 8058 marker) and expects a 303 redirect to a human-readable confirmation page.
export async function POST(request) {
  const config = getNewsletterConfig();
  if (!config.enabled) {
    console.error(`newsletter disabled: missing ${config.missing.join(", ")}`);
    return new Response("Service unavailable", { status: 503 });
  }

  const token = new URL(request.url).searchParams.get("token") || "";
  const rawBody = await request.text();

  const runtime = createNewsletterRuntime();
  const result = await runtime.service.unsubscribe(token);

  if (isOneClickUnsubscribe(rawBody)) {
    return new Response("Unsubscribed", { status: 200 });
  }

  const url = new URL(unsubscribeRedirectPath(rawBody), request.url);
  // The page says what happened: done, already unsubscribed, or a link that isn't valid.
  url.searchParams.set("status", unsubscribeStatus(result));
  return Response.redirect(url, 303);
}
