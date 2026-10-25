import { getNewsletterConfig } from "../../../../newsletter/config.js";
import { createNewsletterRuntime } from "../../../../newsletter/runtime.js";

export const dynamic = "force-dynamic";

export async function POST(request) {
  const { data, isForm } = await parseBody(request);
  const lang = data.lang === "en" ? "en" : "el";

  const config = getNewsletterConfig();
  if (!config.enabled) {
    console.error(`newsletter disabled: missing ${config.missing.join(", ")}`);
    return isForm
      ? redirectToSubscribe(request, "unavailable", lang)
      : Response.json({ ok: false, error: "unavailable" }, { status: 503 });
  }

  let result;
  try {
    const runtime = createNewsletterRuntime();
    result = await runtime.service.subscribe({
      email: data.email,
      lang: data.lang,
      consent: data.consent,
      website: data.website,
      sourcePage: data.sourcePage,
    });
  } catch (error) {
    // Never log the email or any config value, only the error message.
    console.error(`newsletter subscribe failed: ${error.message}`);
    return isForm
      ? redirectToSubscribe(request, "error", lang)
      : Response.json({ ok: false, error: "error" }, { status: 500 });
  }

  if (isForm) {
    return redirectToSubscribe(request, result.ok ? result.status : result.error, lang);
  }
  return Response.json(result, { status: result.ok ? 200 : 400 });
}

async function parseBody(request) {
  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const data = await request.json().catch(() => ({}));
    return { data, isForm: false };
  }
  const form = await request.formData();
  return { data: Object.fromEntries(form.entries()), isForm: true };
}

function redirectToSubscribe(request, status, lang) {
  const path = lang === "en" ? "/en/subscribe" : "/subscribe";
  const url = new URL(path, request.url);
  url.searchParams.set("status", status);
  url.hash = "subscribe";
  return Response.redirect(url, 303);
}
