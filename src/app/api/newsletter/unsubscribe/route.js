import { getNewsletterConfig } from "../../../../newsletter/config.js";
import { createNewsletterRuntime } from "../../../../newsletter/runtime.js";

export const dynamic = "force-dynamic";

// Mail scanners prefetch GET links, so GET must never unsubscribe. Send the human to a page
// with a button that POSTs instead.
export async function GET(request) {
  const token = new URL(request.url).searchParams.get("token") || "";
  const url = new URL("/unsubscribe", request.url);
  if (token) url.searchParams.set("token", token);
  return Response.redirect(url, 303);
}

// RFC 8058 one-click: mail clients POST here with body "List-Unsubscribe=One-Click" and the
// token in the query string. Any body is accepted, and the response is always 200 "Unsubscribed"
// (idempotent, and never reveals whether the token was valid).
export async function POST(request) {
  const config = getNewsletterConfig();
  if (!config.enabled) {
    console.error(`newsletter disabled: missing ${config.missing.join(", ")}`);
    return new Response("Service unavailable", { status: 503 });
  }

  const token = new URL(request.url).searchParams.get("token") || "";
  const runtime = createNewsletterRuntime();
  await runtime.service.unsubscribe(token);
  return new Response("Unsubscribed", { status: 200 });
}
