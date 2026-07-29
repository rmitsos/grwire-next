import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "grwire_private_session";
const SESSION_MESSAGE = "grwire-private-dashboard-v1";

export function createSessionToken(secret = sessionSecret()) {
  return createHmac("sha256", secret).update(SESSION_MESSAGE).digest("base64url");
}

export function verifySessionToken(token, secret = sessionSecret()) {
  if (!token || !secret) return false;
  const expected = createSessionToken(secret);
  const actualBuffer = Buffer.from(String(token));
  const expectedBuffer = Buffer.from(expected);
  return actualBuffer.length === expectedBuffer.length
    && timingSafeEqual(actualBuffer, expectedBuffer);
}

export function passwordMatches(candidate) {
  const expected = process.env.DASHBOARD_PASSWORD;
  if (!expected || typeof candidate !== "string") return false;
  const actualDigest = createHmac("sha256", expected).update(candidate).digest();
  const expectedDigest = createHmac("sha256", expected).update(expected).digest();
  return timingSafeEqual(actualDigest, expectedDigest);
}

function sessionSecret() {
  const value = process.env.DASHBOARD_SESSION_SECRET;
  if (!value) throw new Error("DASHBOARD_SESSION_SECRET is not configured");
  return value;
}
