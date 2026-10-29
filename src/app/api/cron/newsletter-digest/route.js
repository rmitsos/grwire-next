import { NextResponse } from "next/server";
import { cronAuthorised } from "@/newsletter/cron-auth";
import { createNewsletterRuntime } from "@/newsletter/runtime";
import { getNewsletterConfig } from "@/newsletter/config";
import { runDigest } from "@/newsletter/digest";
import { getHomepageData } from "@/public-data";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Vercel cron: 30 6 * * 1-5 (UTC). Does nothing unless NEWSLETTER_DIGEST_ENABLED=true.
export async function GET(request) {
  if (!cronAuthorised(request)) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const config = getNewsletterConfig();
  if (!config.digestEnabled) return NextResponse.json({ ok: true, skipped: "disabled" });
  if (!config.enabled) {
    console.error(`newsletter disabled: missing ${config.missing.join(", ")}`);
    return NextResponse.json({ ok: false, error: "Newsletter is not configured" }, { status: 503 });
  }
  try {
    const runtime = createNewsletterRuntime();
    const result = await runDigest({
      enabled: true,
      store: runtime.store,
      service: runtime.service,
      getHome: getHomepageData,
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error("[newsletter-digest] failed:", error?.message || error);
    return NextResponse.json({ ok: false, error: "Digest failed" }, { status: 500 });
  }
}
