import { neon } from "@neondatabase/serverless";
import { getNewsletterConfig } from "./config.js";
import { createSubscriberStore } from "./store.js";
import { createSesProvider } from "./ses.js";
import { createNewsletterService } from "./service.js";
import { deriveUnsubscribeToken, generateToken } from "./tokens.js";

export function createNewsletterRuntime(env = process.env) {
  const config = getNewsletterConfig(env);
  if (!config.enabled) return null;

  const sql = neon(config.databaseUrl);
  const store = createSubscriberStore(sql);
  const provider = createSesProvider({
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    region: config.region,
    from: config.from,
    fromName: config.fromName,
    replyTo: config.replyTo,
    configurationSetName: config.configurationSet,
  });
  const service = createNewsletterService({
    store,
    provider,
    siteUrl: config.siteUrl,
    now: () => new Date(),
    randomToken: generateToken,
    unsubscribeTokenFor: (email) => deriveUnsubscribeToken(config.tokenSecret, email),
  });

  return { config, store, provider, service };
}
