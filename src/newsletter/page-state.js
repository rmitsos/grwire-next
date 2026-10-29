import { getNewsletterConfig } from "./config.js";
import { createNewsletterRuntime } from "./runtime.js";

// Read-only look at an unsubscribe link, for the page behind it: 'active' | 'unsubscribed' | 'invalid'.
// If the database can't be reached the page falls back to 'active' (the button), because the POST
// still decides what actually happens.
export async function getUnsubscribeState(token, { env = process.env, createRuntime = createNewsletterRuntime } = {}) {
  if (!token) return "invalid";
  if (!getNewsletterConfig(env).enabled) return "active";
  try {
    return await createRuntime(env).service.unsubscribeState(token);
  } catch (error) {
    console.error(`unsubscribe state lookup failed: ${error.message}`);
    return "active";
  }
}

// What the unsubscribe page shows: the button only for a link that is valid and not yet used.
// A used link says "already unsubscribed", an unknown one says the link isn't valid.
export function unsubscribeView({ state, status, hasToken }) {
  if (status) return { statusKey: status, showButton: false };
  if (!hasToken) return { statusKey: null, showButton: false, missing: true };
  if (state === "invalid") return { statusKey: "invalid-unsubscribe", showButton: false };
  if (state === "unsubscribed") return { statusKey: "already-unsubscribed", showButton: false };
  return { statusKey: null, showButton: true };
}
