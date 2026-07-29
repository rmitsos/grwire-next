import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, verifySessionToken } from "./auth-core";
export { createSessionToken, passwordMatches, SESSION_COOKIE } from "./auth-core";

export async function requirePrivateSession() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!verifySessionToken(token)) redirect("/login");
}
