import test from "node:test";
import assert from "node:assert/strict";
import { createNewsletterService } from "../src/newsletter/service.js";
import { getNewsletterConfig } from "../src/newsletter/config.js";
import { createSesProvider } from "../src/newsletter/ses.js";
import { formatAddress } from "../src/newsletter/mime.js";
import { getUnsubscribeState, unsubscribeView } from "../src/newsletter/page-state.js";
import { pickConfirmLang } from "../src/app/api/newsletter/confirm/route.js";
import { unsubscribeStatus } from "../src/app/api/newsletter/unsubscribe/route.js";
import { getLandingCopy } from "../src/landing/copy.js";
import { validationMessage } from "../src/landing/form-validation.js";
import { langFromPathname, NOT_FOUND_LANG_SCRIPT } from "../src/landing/not-found-lang.js";
import { hashToken } from "../src/newsletter/tokens.js";
import { readFileSync } from "node:fs";

// Fake store with the same rules as src/newsletter/store.js (the SQL itself was run against a real
// Postgres while writing this: concurrent submits issue one token, the window is 2 minutes).
function fakeStore() {
  const rows = new Map();
  let ids = 0;
  const WINDOW = 2 * 60 * 1000;
  return {
    rows,
    calls: { upsert: 0 },
    async upsertPending(input) {
      this.calls.upsert += 1;
      const old = rows.get(input.email);
      const keep = old && (old.status === "confirmed" || (old.status === "pending" && Date.now() - old.confirmSentAt < WINDOW));
      if (keep) return { id: old.id, email: old.email, status: old.status, lang: old.lang, issued: false };
      const row = { id: old?.id ?? `id-${++ids}`, email: input.email, status: "pending", lang: input.lang,
        confirmTokenHash: input.confirmTokenHash, confirmSentAt: Date.now(), unsubscribeTokenHash: input.unsubscribeTokenHash };
      rows.set(input.email, row);
      return { id: row.id, email: row.email, status: row.status, lang: row.lang, issued: true };
    },
    async confirmByTokenHash(hash) {
      for (const r of rows.values()) if (r.confirmTokenHash === hash && r.status === "pending") { r.status = "confirmed"; return { id: r.id, email: r.email, lang: r.lang }; }
      return null;
    },
    async findByConfirmTokenHash(hash) {
      for (const r of rows.values()) if (r.confirmTokenHash === hash) return { status: r.status, lang: r.lang };
      return null;
    },
    async unsubscribeStateByTokenHash(hash) {
      for (const r of rows.values()) if (r.unsubscribeTokenHash === hash) return r.status === "unsubscribed" ? "unsubscribed" : "active";
      return "invalid";
    },
    async unsubscribeByTokenHash(hash) {
      for (const r of rows.values()) if (r.unsubscribeTokenHash === hash) { const already = r.status === "unsubscribed"; r.status = "unsubscribed"; return { found: true, already }; }
      return { found: false, already: false };
    },
  };
}

function setup() {
  const store = fakeStore();
  const sent = [];
  let n = 0;
  const service = createNewsletterService({
    store, provider: { async send(m) { sent.push(m); return { id: `m${sent.length}` }; } },
    siteUrl: "https://www.grwire.com", now: () => new Date(), randomToken: () => `tok-${++n}`,
    unsubscribeTokenFor: (email) => `unsub-${email}`,
  });
  return { store, sent, service };
}

const tokenOf = (message) => /token=([^&\s]+)/.exec(message.text)[1];

// --- #21 double submit ---------------------------------------------------------------------

test("#21 a repeat submit for a pending address sends no second email and keeps the first link working", async () => {
  const { sent, service } = setup();
  const first = await service.subscribe({ email: "dbl@example.com", lang: "el", consent: true });
  const second = await service.subscribe({ email: "dbl@example.com", lang: "el", consent: true });
  assert.deepEqual(first, { ok: true, status: "check-inbox" });
  assert.deepEqual(second, { ok: true, status: "check-inbox" }, "same neutral answer");
  assert.equal(sent.length, 1);
  const confirmed = await service.confirm(tokenOf(sent[0]));
  assert.equal(confirmed.ok, true, "the first link still works");
});

test("#21 after the 2-minute window a new submit sends a fresh email", async () => {
  const { store, sent, service } = setup();
  await service.subscribe({ email: "later@example.com", lang: "el", consent: true });
  store.rows.get("later@example.com").confirmSentAt = Date.now() - 3 * 60 * 1000;
  await service.subscribe({ email: "later@example.com", lang: "el", consent: true });
  assert.equal(sent.length, 2);
  assert.notEqual(tokenOf(sent[0]), tokenOf(sent[1]));
});

test("#21 the subscribe form disables its button once submitted", () => {
  const source = readFileSync(new URL("../src/components/landing/SubscribeForm.js", import.meta.url), "utf8");
  assert.match(source, /^"use client"/);
  assert.match(source, /disabled=\{busy\}/);
  assert.match(source, /if \(submitted\.current\) \{\s*event\.preventDefault\(\)/, "a second submit event is cancelled");
  assert.match(source, /onSubmit=\{onSubmit\}/);
});

// --- #7 used confirm link ------------------------------------------------------------------

test("#7 a second click on a used confirm link says already confirmed, in the subscriber's language", async () => {
  const { sent, service } = setup();
  await service.subscribe({ email: "once@example.com", lang: "en", consent: true });
  const token = tokenOf(sent[0]);
  assert.deepEqual(await service.confirm(token), { ok: true, lang: "en" });
  assert.deepEqual(await service.confirm(token), { ok: true, already: true, lang: "en" });
  assert.equal(sent.length, 2, "confirmation + welcome only; the re-click sends nothing");
});

test("#7 an unknown token is still an invalid link, with no language", async () => {
  const { service } = setup();
  assert.deepEqual(await service.confirm("nope"), { ok: false, error: "invalid-or-expired", lang: null });
  assert.deepEqual(await service.confirm(""), { ok: false, error: "invalid-or-expired" }, "no token: the route falls back to the link or browser language");
});

test("#7 already-confirmed has el and en messages", () => {
  for (const lang of ["el", "en"]) {
    const message = getLandingCopy(lang).statusMessages["already-confirmed"];
    assert.equal(message.tone, "ok");
    assert.ok(message.text.length > 10);
  }
  assert.match(getLandingCopy("el").statusMessages["already-confirmed"].text, /επιβεβαιωθεί/);
  assert.match(getLandingCopy("en").statusMessages["already-confirmed"].text, /already confirmed/);
});

// --- invalid confirm link language ---------------------------------------------------------

test("invalid confirm link: language comes from the link, then the subscriber, then Accept-Language, then Greek", () => {
  assert.equal(pickConfirmLang({ paramLang: "en", subscriberLang: "el" }), "en");
  assert.equal(pickConfirmLang({ paramLang: "el", acceptLanguage: "en-US,en" }), "el");
  assert.equal(pickConfirmLang({ subscriberLang: "en", acceptLanguage: "el" }), "en");
  assert.equal(pickConfirmLang({ acceptLanguage: "en-GB,en;q=0.9,el;q=0.8" }), "en");
  assert.equal(pickConfirmLang({ acceptLanguage: "el-GR,el;q=0.9,en;q=0.5" }), "el");
  assert.equal(pickConfirmLang({ acceptLanguage: "de-DE" }), "el");
  assert.equal(pickConfirmLang({}), "el");
  assert.equal(pickConfirmLang({ paramLang: "fr" }), "el");
});

test("confirmation links always carry the language", async () => {
  const { sent, service } = setup();
  await service.subscribe({ email: "g@example.com", lang: "el", consent: true });
  await service.subscribe({ email: "e@example.com", lang: "en", consent: true });
  assert.match(sent[0].text, /confirm\?token=[^&\s]+&lang=el/);
  assert.match(sent[1].text, /confirm\?token=[^&\s]+&lang=en/);
});

// --- unsubscribe states --------------------------------------------------------------------

test("unsubscribe page state: active, used and invalid tokens", async () => {
  const { service } = setup();
  await service.subscribe({ email: "u@example.com", lang: "el", consent: true });
  assert.equal(await service.unsubscribeState("unsub-u@example.com"), "active");
  assert.equal(await service.unsubscribeState("garbage"), "invalid");
  assert.equal(await service.unsubscribeState(""), "invalid");
  await service.unsubscribe("unsub-u@example.com");
  assert.equal(await service.unsubscribeState("unsub-u@example.com"), "unsubscribed");
  assert.deepEqual(await service.unsubscribe("unsub-u@example.com"), { ok: true, already: true });
});

test("unsubscribe page: the button shows only for a valid unused link", () => {
  assert.deepEqual(unsubscribeView({ state: "active", status: null, hasToken: true }), { statusKey: null, showButton: true });
  assert.deepEqual(unsubscribeView({ state: "unsubscribed", status: null, hasToken: true }), { statusKey: "already-unsubscribed", showButton: false });
  assert.deepEqual(unsubscribeView({ state: "invalid", status: null, hasToken: true }), { statusKey: "invalid-unsubscribe", showButton: false });
  assert.deepEqual(unsubscribeView({ state: null, status: "done", hasToken: false }), { statusKey: "done", showButton: false });
  assert.equal(unsubscribeView({ state: null, status: null, hasToken: false }).missing, true);
});

test("unsubscribe page falls back to the button when the lookup is impossible", async () => {
  assert.equal(await getUnsubscribeState("abc", { env: {} }), "active", "newsletter not configured");
  const env = { AWS_SES_ACCESS_KEY_ID: "a", AWS_SES_SECRET_ACCESS_KEY: "b", NEWSLETTER_FROM: "x@y.z", NEWSLETTER_SITE_URL: "https://s", DATABASE_URL: "postgres://u", CRON_SECRET: "c" };
  const broken = () => { throw new Error("db down"); };
  const quiet = console.error; console.error = () => {};
  try { assert.equal(await getUnsubscribeState("abc", { env, createRuntime: broken }), "active"); } finally { console.error = quiet; }
  assert.equal(await getUnsubscribeState("", { env }), "invalid");
  const ok = () => ({ service: { unsubscribeState: async (t) => (t === "used" ? "unsubscribed" : "invalid") } });
  assert.equal(await getUnsubscribeState("used", { env, createRuntime: ok }), "unsubscribed");
  assert.equal(await getUnsubscribeState("bad", { env, createRuntime: ok }), "invalid");
});

test("unsubscribe form post maps the result to a page status", () => {
  assert.equal(unsubscribeStatus({ ok: true, already: false }), "done");
  assert.equal(unsubscribeStatus({ ok: true, already: true }), "already-unsubscribed");
  assert.equal(unsubscribeStatus({ ok: false, error: "invalid" }), "invalid-unsubscribe");
});

test("unsubscribe statuses have el and en messages with the right tone", () => {
  for (const lang of ["el", "en"]) {
    const messages = getLandingCopy(lang).statusMessages;
    assert.equal(messages["already-unsubscribed"].tone, "ok");
    assert.equal(messages["invalid-unsubscribe"].tone, "error");
  }
  assert.match(getLandingCopy("el").statusMessages["invalid-unsubscribe"].text, /δεν είναι έγκυρος/);
  assert.match(getLandingCopy("en").statusMessages["already-unsubscribed"].text, /already/);
});

test("the one-click POST route never reveals token validity (still a plain 200 for any token)", () => {
  const source = readFileSync(new URL("../src/app/api/newsletter/unsubscribe/route.js", import.meta.url), "utf8");
  const oneClick = source.indexOf("isOneClickUnsubscribe(rawBody)) {");
  assert.ok(oneClick > 0);
  assert.match(source.slice(oneClick, oneClick + 120), /new Response\("Unsubscribed", \{ status: 200 \}\)/);
});

// --- #27 branded 404 -----------------------------------------------------------------------

test("#27 404 language follows the path: Greek by default, English under /en", () => {
  for (const path of ["/", "/no-such-page", "/a/b/c", "/envision", "/english", "/entry?x=/en/"]) assert.equal(langFromPathname(path), "el", path);
  for (const path of ["/en", "/en/", "/en/no-such-page", "/en/a/b", "/en?x=1"]) assert.equal(langFromPathname(path), "en", path);
});

test("#27 the in-page script picks the same language as langFromPathname", () => {
  for (const path of ["/", "/zzz", "/en", "/en/zzz", "/envision", "/en/a/b"]) {
    const document = { documentElement: {} };
    new Function("location", "document", NOT_FOUND_LANG_SCRIPT)({ pathname: path }, document);
    assert.equal(document.documentElement.lang, langFromPathname(path), path);
  }
});

test("#27 not-found copy exists in both languages and the page is wired in", () => {
  assert.equal(getLandingCopy("el").notFound.title, "Η σελίδα δεν βρέθηκε");
  assert.equal(getLandingCopy("en").notFound.title, "Page not found");
  const page = readFileSync(new URL("../src/app/global-not-found.js", import.meta.url), "utf8");
  assert.match(page, /NotFoundView lang="el"/);
  assert.match(page, /NotFoundView lang="en"/);
  assert.match(page, /landing\.css/);
  const css = readFileSync(new URL("../src/app/landing.css", import.meta.url), "utf8");
  assert.match(css, /html\[lang="el"\] \.nf-en/);
  assert.match(css, /html\[lang="en"\] \.nf-el/);
});

// --- #4 From display name ------------------------------------------------------------------

test("#4 NEWSLETTER_FROM 'GR Wire <news@mail.grwire.com>' splits into name and address", () => {
  const config = getNewsletterConfig({ NEWSLETTER_FROM: "GR Wire <news@mail.grwire.com>" });
  assert.equal(config.from, "news@mail.grwire.com");
  assert.equal(config.fromName, "GR Wire");
  assert.equal(getNewsletterConfig({ NEWSLETTER_FROM: '"GR Wire" <news@mail.grwire.com>' }).fromName, "GR Wire");
  assert.equal(getNewsletterConfig({ NEWSLETTER_FROM: "news@mail.grwire.com" }).fromName, "GR Wire", "bare address gets the default name");
});

test("#4 the From shown by SES carries the display name: FromEmailAddress and the raw header", async () => {
  const calls = [];
  const provider = createSesProvider({
    accessKeyId: "AKIAEXAMPLE", secretAccessKey: "SECRETEXAMPLEVALUE", from: "news@mail.grwire.com", fromName: "GR Wire",
    fetch: async (url, options) => { calls.push(options); return { ok: true, status: 200, json: async () => ({ MessageId: "m" }) }; },
  });
  await provider.send({ to: "r@example.com", subject: "s", html: "<p>h</p>", text: "t", headers: {} });
  const body = JSON.parse(calls[0].body);
  assert.equal(body.FromEmailAddress, '"GR Wire" <news@mail.grwire.com>');
  assert.match(Buffer.from(body.Content.Raw.Data, "base64").toString("utf8"), /^From: "GR Wire" <news@mail\.grwire\.com>\r\n/);
});

test("#4 a non-ASCII display name is RFC 2047 encoded, and a quote can't break out of the name", () => {
  assert.equal(formatAddress("GR Wire", "n@x.gr"), '"GR Wire" <n@x.gr>');
  assert.equal(formatAddress("", "n@x.gr"), "n@x.gr");
  const greek = formatAddress("Τηλεπικοινωνίες", "n@x.gr");
  assert.match(greek, /^=\?UTF-8\?B\?[A-Za-z0-9+/=]+\?= <n@x\.gr>$/);
  assert.equal(Buffer.from(/\?B\?(.*)\?=/.exec(greek)[1], "base64").toString("utf8"), "Τηλεπικοινωνίες");
  assert.equal(formatAddress('GR "Wire"', "n@x.gr"), '"GR \\"Wire\\"" <n@x.gr>');
});

// --- #7 (minor) Greek validation messages --------------------------------------------------

test("form validation bubbles are in the page language", () => {
  for (const lang of ["el", "en"]) {
    const copy = getLandingCopy(lang).subscribeForm;
    assert.equal(validationMessage("consent", { valueMissing: true }, copy), copy.consentRequired);
    assert.equal(validationMessage("email", { valueMissing: true }, copy), copy.emailMissing);
    assert.equal(validationMessage("email", { typeMismatch: true }, copy), copy.emailInvalid);
  }
  const el = getLandingCopy("el").subscribeForm;
  assert.match(el.consentRequired, /Πρέπει να αποδεχτείτε/);
  assert.doesNotMatch(el.emailMissing + el.emailInvalid + el.consentRequired, /[a-z]{4,}.*please/i);
  const source = readFileSync(new URL("../src/components/landing/SubscribeForm.js", import.meta.url), "utf8");
  assert.match(source, /onInvalid=\{showMessage\("consent"\)\}/);
  assert.match(source, /onChange=\{clearMessage\}/);
});

test("hashToken is stable (used for the confirm lookup of a used link)", () => {
  assert.equal(hashToken("abc"), hashToken("abc"));
});
