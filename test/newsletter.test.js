import test from "node:test";
import assert from "node:assert/strict";
import {
  createNewsletterService,
  validateEmail,
  CONSENT_TEXT_VERSION,
} from "../src/newsletter/service.js";
import { createResendProvider, assertTrackingDisabled } from "../src/newsletter/provider.js";
import { getNewsletterConfig } from "../src/newsletter/config.js";
import { generateToken, hashToken, hashesMatch } from "../src/newsletter/tokens.js";

function createFakeStore() {
  const rows = new Map();
  let idCounter = 0;
  return {
    rows,
    async upsertPending({ email, lang, consentTextVersion, sourcePage, confirmTokenHash, unsubscribeTokenHash }) {
      const existing = rows.get(email);
      if (existing && existing.status === "confirmed") {
        return { id: existing.id, email, status: existing.status, lang: existing.lang };
      }
      const row = {
        id: existing?.id ?? `id-${++idCounter}`,
        email,
        status: "pending",
        lang,
        consentTextVersion,
        sourcePage,
        confirmTokenHash,
        confirmSentAt: new Date(),
        unsubscribeTokenHash,
      };
      rows.set(email, row);
      return { id: row.id, email, status: row.status, lang: row.lang };
    },
    async confirmByTokenHash(hash, { maxAgeDays = 7 } = {}) {
      for (const row of rows.values()) {
        if (row.confirmTokenHash === hash && row.status === "pending") {
          const ageMs = Date.now() - row.confirmSentAt.getTime();
          if (ageMs > maxAgeDays * 24 * 60 * 60 * 1000) return null;
          row.status = "confirmed";
          row.confirmTokenHash = null;
          return { id: row.id, email: row.email, lang: row.lang };
        }
      }
      return null;
    },
    async unsubscribeByTokenHash(hash) {
      for (const row of rows.values()) {
        if (row.unsubscribeTokenHash === hash) {
          row.status = "unsubscribed";
          return { found: true };
        }
      }
      return { found: false };
    },
  };
}

function createFakeProvider() {
  const sent = [];
  return {
    sent,
    async send(message) {
      sent.push(message);
      return { id: `sent-${sent.length}` };
    },
  };
}

function createTokenSequence() {
  let n = 0;
  return () => `token-${++n}`;
}

function setup() {
  const store = createFakeStore();
  const provider = createFakeProvider();
  const randomToken = createTokenSequence();
  const service = createNewsletterService({
    store,
    provider,
    siteUrl: "https://www.grwire.com",
    now: () => new Date("2026-10-25T12:00:00Z"),
    randomToken,
  });
  return { store, provider, service };
}

function extractToken(text, param) {
  const match = text.match(new RegExp(`${param}=([^\\s&"]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

test("subscribe: honeypot silently no-ops", async () => {
  const { store, provider, service } = setup();
  const result = await service.subscribe({
    email: "bot@example.com",
    lang: "el",
    consent: true,
    website: "http://spam.example",
  });
  assert.deepEqual(result, { ok: true, status: "check-inbox" });
  assert.equal(store.rows.size, 0);
  assert.equal(provider.sent.length, 0);
});

test("subscribe: consent is required", async () => {
  const { store, provider, service } = setup();
  const result = await service.subscribe({ email: "a@example.com", lang: "el", consent: false });
  assert.deepEqual(result, { ok: false, error: "consent-required" });
  assert.equal(store.rows.size, 0);
  assert.equal(provider.sent.length, 0);
});

test("subscribe: rejects an invalid email", async () => {
  const { service } = setup();
  const result = await service.subscribe({ email: "not-an-email", lang: "el", consent: true });
  assert.deepEqual(result, { ok: false, error: "invalid-email" });
});

test("validateEmail normalizes and bounds length", () => {
  assert.equal(validateEmail(" Foo@Example.COM "), "foo@example.com");
  assert.equal(validateEmail("no-at-sign"), null);
  assert.equal(validateEmail(`${"a".repeat(250)}@b.co`), null);
  assert.equal(validateEmail(42), null);
});

test("subscribe: stores a pending row and sends one confirmation email, EL and EN", async () => {
  const { store, provider, service } = setup();

  const elResult = await service.subscribe({ email: "el@example.com", lang: "el", consent: "on" });
  assert.deepEqual(elResult, { ok: true, status: "check-inbox" });
  assert.equal(provider.sent.length, 1);
  assert.equal(provider.sent[0].subject, "Επιβεβαιώστε την εγγραφή σας στο GR Wire");
  assert.equal(store.rows.get("el@example.com").status, "pending");
  assert.equal(store.rows.get("el@example.com").consentTextVersion, CONSENT_TEXT_VERSION);

  const enResult = await service.subscribe({ email: "en@example.com", lang: "en", consent: "yes" });
  assert.deepEqual(enResult, { ok: true, status: "check-inbox" });
  assert.equal(provider.sent.length, 2);
  assert.equal(provider.sent[1].subject, "Confirm your GR Wire subscription");
});

test("subscribe: repeat subscription of an already-confirmed address sends nothing", async () => {
  const { store, provider, service } = setup();
  await service.subscribe({ email: "repeat@example.com", lang: "el", consent: true });
  const confirmToken = extractToken(provider.sent[0].text, "token");
  const confirmResult = await service.confirm(confirmToken);
  assert.deepEqual(confirmResult, { ok: true });
  assert.equal(store.rows.get("repeat@example.com").status, "confirmed");

  const secondResult = await service.subscribe({ email: "repeat@example.com", lang: "el", consent: true });
  assert.deepEqual(secondResult, { ok: true, status: "check-inbox" });
  assert.equal(provider.sent.length, 1, "no second confirmation email is sent");
});

test("confirm: valid token confirms the row", async () => {
  const { store, provider, service } = setup();
  await service.subscribe({ email: "valid@example.com", lang: "el", consent: true });
  const token = extractToken(provider.sent[0].text, "token");
  const result = await service.confirm(token);
  assert.deepEqual(result, { ok: true });
  assert.equal(store.rows.get("valid@example.com").status, "confirmed");
});

test("confirm: expired token is rejected", async () => {
  const { store, provider, service } = setup();
  await service.subscribe({ email: "expired@example.com", lang: "el", consent: true });
  const token = extractToken(provider.sent[0].text, "token");
  const row = store.rows.get("expired@example.com");
  row.confirmSentAt = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);

  const result = await service.confirm(token);
  assert.deepEqual(result, { ok: false, error: "invalid-or-expired" });
  assert.equal(store.rows.get("expired@example.com").status, "pending");
});

test("confirm: unknown token is rejected", async () => {
  const { service } = setup();
  const result = await service.confirm("this-token-does-not-exist");
  assert.deepEqual(result, { ok: false, error: "invalid-or-expired" });
});

test("unsubscribe: idempotent for a known token, invalid for an unknown one", async () => {
  const { store, service } = setup();
  await service.subscribe({ email: "unsub@example.com", lang: "el", consent: true });
  // Deterministic fake randomToken: 1st call per subscribe() is the confirm token, 2nd is unsubscribe.
  const unsubscribeToken = "token-2";
  assert.equal(hashToken(unsubscribeToken), store.rows.get("unsub@example.com").unsubscribeTokenHash);

  const first = await service.unsubscribe(unsubscribeToken);
  assert.deepEqual(first, { ok: true });
  assert.equal(store.rows.get("unsub@example.com").status, "unsubscribed");

  const second = await service.unsubscribe(unsubscribeToken);
  assert.deepEqual(second, { ok: true }, "repeating the same unsubscribe call stays ok");

  const unknown = await service.unsubscribe("never-issued");
  assert.deepEqual(unknown, { ok: false, error: "invalid" });
});

test("buildListUnsubscribeHeaders matches RFC 8058 exactly", () => {
  const { service } = setup();
  const headers = service.buildListUnsubscribeHeaders("https://www.grwire.com/unsubscribe?token=abc");
  assert.deepEqual(headers, {
    "List-Unsubscribe": "<https://www.grwire.com/unsubscribe?token=abc>",
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  });
});

test("sendToSubscriber refuses to send to a non-confirmed subscriber", async () => {
  const { service } = setup();
  await assert.rejects(
    () => service.sendToSubscriber({
      subscriber: { email: "pending@example.com", status: "pending" },
      unsubscribeToken: "tok",
      subject: "Weekly",
      html: "<p>hi</p>",
      text: "hi",
    }),
    /not confirmed/,
  );
});

test("sendToSubscriber sends to a confirmed subscriber with unsubscribe headers and link", async () => {
  const { provider, service } = setup();
  await service.sendToSubscriber({
    subscriber: { email: "confirmed@example.com", status: "confirmed" },
    unsubscribeToken: "weekly-tok",
    subject: "Weekly",
    html: "<p>hi</p>",
    text: "hi",
  });
  assert.equal(provider.sent.length, 1);
  const message = provider.sent[0];
  assert.equal(message.to, "confirmed@example.com");
  assert.deepEqual(message.headers, {
    "List-Unsubscribe": "<https://www.grwire.com/unsubscribe?token=weekly-tok>",
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  });
  assert.match(message.html, /unsubscribe\?token=weekly-tok/);
  assert.match(message.text, /unsubscribe\?token=weekly-tok/);
});

test("tokens: hashesMatch is constant-time-safe and correct", () => {
  const token = generateToken();
  const hash = hashToken(token);
  assert.equal(hashesMatch(hash, hashToken(token)), true);
  assert.equal(hashesMatch(hash, hashToken("something-else")), false);
  assert.equal(hashesMatch(hash, ""), false);
});

test("Resend provider: request shape and error does not leak the API key", async () => {
  const calls = [];
  const fakeFetch = async (url, options) => {
    calls.push({ url, options });
    return { ok: true, status: 200, json: async () => ({ id: "email_123" }) };
  };
  const provider = createResendProvider({
    apiKey: "re_super_secret_key",
    from: "GR Wire <weekly@grwire.com>",
    fetch: fakeFetch,
  });

  await provider.send({
    to: "reader@example.com",
    subject: "Weekly",
    html: "<p>hi</p>",
    text: "hi",
    headers: { "List-Unsubscribe": "<https://www.grwire.com/unsubscribe?token=x>" },
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://api.resend.com/emails");
  assert.equal(calls[0].options.method, "POST");
  assert.equal(calls[0].options.headers.Authorization, "Bearer re_super_secret_key");
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    from: "GR Wire <weekly@grwire.com>",
    to: ["reader@example.com"],
    subject: "Weekly",
    html: "<p>hi</p>",
    text: "hi",
    headers: { "List-Unsubscribe": "<https://www.grwire.com/unsubscribe?token=x>" },
  });

  const failingFetch = async () => ({ ok: false, status: 401, json: async () => ({ message: "bad key" }) });
  const failingProvider = createResendProvider({
    apiKey: "re_super_secret_key",
    from: "GR Wire <weekly@grwire.com>",
    fetch: failingFetch,
  });
  await assert.rejects(
    () => failingProvider.send({ to: "x@example.com", subject: "s", html: "h", text: "t" }),
    (error) => {
      assert.match(error.message, /401/);
      assert.doesNotMatch(error.message, /re_super_secret_key/);
      return true;
    },
  );
});

test("assertTrackingDisabled throws when open or click tracking is on", async () => {
  const trackingOnFetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({ open_tracking: true, click_tracking: false }),
  });
  await assert.rejects(
    () => assertTrackingDisabled({ apiKey: "k", domainId: "d1", fetch: trackingOnFetch }),
    /tracking/i,
  );

  const trackingOffFetch = async () => ({ ok: true, status: 200, json: async () => ({}) });
  await assert.doesNotReject(
    () => assertTrackingDisabled({ apiKey: "k", domainId: "d1", fetch: trackingOffFetch }),
  );
});

test("getNewsletterConfig reports enabled/missing by name only, never secret values", () => {
  const disabled = getNewsletterConfig({});
  assert.equal(disabled.enabled, false);
  assert.deepEqual(disabled.missing.sort(), [
    "DATABASE_URL",
    "NEWSLETTER_FROM",
    "NEWSLETTER_SITE_URL",
    "RESEND_API_KEY",
  ]);

  const enabled = getNewsletterConfig({
    RESEND_API_KEY: "re_super_secret_key",
    NEWSLETTER_FROM: "GR Wire <weekly@grwire.com>",
    NEWSLETTER_SITE_URL: "https://www.grwire.com",
    DATABASE_URL: "postgres://user:pass@host/db",
  });
  assert.equal(enabled.enabled, true);
  assert.deepEqual(enabled.missing, []);
  for (const name of disabled.missing) {
    assert.doesNotMatch(name, /secret|postgres:\/\//);
  }
});

test("subscribe route: returns 503 and never touches the DB when config is missing", async () => {
  const keys = ["RESEND_API_KEY", "NEWSLETTER_FROM", "NEWSLETTER_SITE_URL", "DATABASE_URL"];
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  for (const key of keys) delete process.env[key];

  try {
    const { POST } = await import("../src/app/api/newsletter/subscribe/route.js");
    const request = new Request("https://www.grwire.com/api/newsletter/subscribe", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "a@example.com", lang: "el", consent: true }),
    });
    const response = await POST(request);
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { ok: false, error: "unavailable" });
  } finally {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
});
