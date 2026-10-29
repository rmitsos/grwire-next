import { randomBytes, createHash, createHmac, timingSafeEqual } from "node:crypto";

export function generateToken() {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token) {
  return createHash("sha256").update(String(token)).digest("hex");
}

export function hashesMatch(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || !a || !b) return false;
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  return bufferA.length === bufferB.length && timingSafeEqual(bufferA, bufferB);
}

// Deterministic per-address unsubscribe token: the same link works in every email we ever send
// that address, so no rotation is needed and older emails keep working. Only its sha256 is stored.
export function deriveUnsubscribeToken(secret, email) {
  return createHmac("sha256", String(secret)).update(`unsubscribe:${String(email).toLowerCase()}`).digest("base64url");
}
