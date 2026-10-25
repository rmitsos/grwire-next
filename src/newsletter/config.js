const REQUIRED_VARS = ["RESEND_API_KEY", "NEWSLETTER_FROM", "NEWSLETTER_SITE_URL", "DATABASE_URL"];

// `missing` only ever carries env var *names*, never values — keep it that way so logs
// and error responses built from it can never leak a secret.
export function getNewsletterConfig(env = process.env) {
  const missing = REQUIRED_VARS.filter((name) => !env[name]);
  return {
    enabled: missing.length === 0,
    missing,
    apiKey: env.RESEND_API_KEY,
    from: env.NEWSLETTER_FROM,
    siteUrl: env.NEWSLETTER_SITE_URL,
    databaseUrl: env.DATABASE_URL,
    domainId: env.RESEND_DOMAIN_ID || null,
  };
}
