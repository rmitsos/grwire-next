import { getNewsletterConfig } from "../../../../newsletter/config.js";
import { createNewsletterRuntime } from "../../../../newsletter/runtime.js";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const config = getNewsletterConfig();
  if (!config.enabled) {
    console.error(`newsletter disabled: missing ${config.missing.join(", ")}`);
    return Response.redirect(subscribeUrl(request, "unavailable"), 303);
  }

  const token = new URL(request.url).searchParams.get("token");
  const runtime = createNewsletterRuntime();
  const result = await runtime.service.confirm(token);

  if (!result.ok) {
    return Response.redirect(subscribeUrl(request, "invalid-link"), 303);
  }
  return Response.redirect(new URL("/subscribe/confirmed", request.url), 303);
}

function subscribeUrl(request, status) {
  const url = new URL("/subscribe", request.url);
  url.searchParams.set("status", status);
  return url;
}
