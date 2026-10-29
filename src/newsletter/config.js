// Names only, never values: `missing` goes into logs and error responses.
const REQUIRED_VARS = [
  "AWS_SES_ACCESS_KEY_ID",
  "AWS_SES_SECRET_ACCESS_KEY",
  "NEWSLETTER_FROM",
  "NEWSLETTER_SITE_URL",
  "DATABASE_URL",
];

export function getNewsletterConfig(env = process.env) {
  const missing = REQUIRED_VARS.filter((name) => !env[name]);
  // The unsubscribe link in every email is an HMAC of the address, so one secret is needed.
  // NEWSLETTER_TOKEN_SECRET wins; CRON_SECRET (already set on the project) is the fallback.
  const tokenSecret = env.NEWSLETTER_TOKEN_SECRET || env.CRON_SECRET || null;
  if (!tokenSecret) missing.push("NEWSLETTER_TOKEN_SECRET or CRON_SECRET");
  // NEWSLETTER_FROM may be "GR Wire <news@mail.grwire.com>" or a bare address.
  const fromMatch = /^\s*(.*?)\s*<([^<>\s]+)>\s*$/.exec(env.NEWSLETTER_FROM || "");
  const from = fromMatch ? fromMatch[2] : env.NEWSLETTER_FROM;
  const fromName = fromMatch && fromMatch[1] ? fromMatch[1].replace(/^"|"$/g, "") : env.NEWSLETTER_FROM_NAME || "GR Wire";
  return {
    enabled: missing.length === 0,
    missing,
    accessKeyId: env.AWS_SES_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SES_SECRET_ACCESS_KEY,
    region: env.AWS_SES_REGION || "eu-central-1",
    configurationSet: env.AWS_SES_CONFIGURATION_SET || null,
    from,
    fromName,
    replyTo: env.NEWSLETTER_REPLY_TO || null,
    siteUrl: (env.NEWSLETTER_SITE_URL || "").replace(/\/+$/, ""),
    databaseUrl: env.DATABASE_URL,
    tokenSecret,
    // Off unless explicitly "true": the daily send never starts by accident.
    digestEnabled: env.NEWSLETTER_DIGEST_ENABLED === "true",
  };
}
