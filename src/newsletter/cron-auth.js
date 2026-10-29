// Same rule as /api/ingest: Vercel Cron sends `Authorization: Bearer $CRON_SECRET`.
export function cronAuthorised(request, env = process.env) {
  const secret = env.CRON_SECRET;
  return Boolean(secret) && request.headers.get("authorization") === `Bearer ${secret}`;
}
