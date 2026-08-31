import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/auth-core";
import { ingestMarket } from "@/ingest-service";

export const maxDuration = 300;

export async function GET(request) {
  if (!cronAuthorised(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  return run();
}

export async function POST(request) {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!verifySessionToken(token)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const response = await run();
  if (new URL(request.url).searchParams.get("return") === "intelligence" && response.ok) {
    return NextResponse.redirect(new URL("/intelligence", request.url), 303);
  }
  return response;
}

async function run() {
  try {
    const result = await ingestMarket();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("[ingest] failed:", error?.message || error);
    return NextResponse.json({ ok: false, error: error?.message || "Ingestion failed" }, { status: 500 });
  }
}

function cronAuthorised(request) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret) && request.headers.get("authorization") === `Bearer ${secret}`;
}
