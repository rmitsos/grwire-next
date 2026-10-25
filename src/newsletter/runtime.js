import { neon } from "@neondatabase/serverless";
import { getNewsletterConfig } from "./config.js";
import { createSubscriberStore } from "./store.js";
import { createResendProvider } from "./provider.js";
import { createNewsletterService } from "./service.js";
import { generateToken } from "./tokens.js";

export function createNewsletterRuntime(env = process.env) {
  const config = getNewsletterConfig(env);
  if (!config.enabled) return null;

  const sql = neon(config.databaseUrl);
  const store = createSubscriberStore(sql);
  const provider = createResendProvider({ apiKey: config.apiKey, from: config.from });
  const service = createNewsletterService({
    store,
    provider,
    siteUrl: config.siteUrl,
    now: () => new Date(),
    randomToken: generateToken,
  });

  return { config, store, provider, service };
}
