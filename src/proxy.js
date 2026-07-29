import { NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "./auth-core";

export function proxy(request) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (verifySessionToken(token)) return NextResponse.next();

  const login = new URL("/login", request.url);
  login.searchParams.set("from", request.nextUrl.pathname);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/intelligence/:path*"],
};
