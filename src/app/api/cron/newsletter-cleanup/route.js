import { NextResponse } from "next/server";
import { cronAuthorised } from "@/newsletter/cron-auth";
import { createNewsletterRuntime } from "@/newsletter/runtime";

export const dynamic = "force-dynamic";

// Vercel cron: 10 3 * * * (UTC). Deletes sign-ups that never confirmed within 7 days.
export async function GET(request) {
  if (!cronAuthorised(request)) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const runtime = createNewsletterRuntime();
  if (!runtime) return NextResponse.json({ ok: true, skipped: "not-configured" });
  try {
    const deleted = await runtime.store.deleteStalePending({ olderThanDays: 7 });
    return NextResponse.json({ ok: true, deleted });
  } catch (error) {
    console.error("[newsletter-cleanup] failed:", error?.message || error);
    return NextResponse.json({ ok: false, error: "Cleanup failed" }, { status: 500 });
  }
}
