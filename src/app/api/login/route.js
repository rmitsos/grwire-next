import { NextResponse } from "next/server";
import {
  createSessionToken,
  passwordMatches,
  SESSION_COOKIE,
} from "@/session";

export async function POST(request) {
  const form = await request.formData();
  const password = String(form.get("password") || "");
  const url = new URL("/intelligence", request.url);

  if (!process.env.DASHBOARD_PASSWORD || !process.env.DASHBOARD_SESSION_SECRET) {
    return NextResponse.redirect(new URL("/login?error=config", request.url), 303);
  }
  if (!passwordMatches(password)) {
    return NextResponse.redirect(new URL("/login?error=1", request.url), 303);
  }

  const response = NextResponse.redirect(url, 303);
  response.cookies.set(SESSION_COOKIE, createSessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 60 * 60 * 12,
    path: "/",
    priority: "high",
  });
  return response;
}
