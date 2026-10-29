import test from "node:test";
import assert from "node:assert/strict";
import { createHmac, createHash } from "node:crypto";
import { getNewsletterConfig } from "../src/newsletter/config.js";
import { createSesProvider, signRequest } from "../src/newsletter/ses.js";
import { buildRawEmail } from "../src/newsletter/mime.js";
import { confirmationEmail, welcomeEmail, digestEmail } from "../src/newsletter/emails.js";
import { createNewsletterService, CONSENT_TEXT, CONSENT_TEXT_VERSION } from "../src/newsletter/service.js";
import { deriveUnsubscribeToken, hashToken } from "../src/newsletter/tokens.js";
import { athensDateKey, isAthensWeekday, pickDigestStories, runDigest } from "../src/newsletter/digest.js";
import { cronAuthorised } from "../src/newsletter/cron-auth.js";
import { LANDING_COPY } from "../src/landing/copy.js";

const ENV = {
  AWS_SES_ACCESS_KEY_ID: "AKIAEXAMPLE", AWS_SES_SECRET_ACCESS_KEY: "SECRETEXAMPLEVALUE",
  NEWSLETTER_FROM: "GR Wire <news@mail.grwire.com>", NEWSLETTER_REPLY_TO: "d.roussos@tarenosystems.com",
  NEWSLETTER_SITE_URL: "https://www.grwire.com/", DATABASE_URL: "postgres://u:p@h/db", CRON_SECRET: "cron-secret",
};

test("config: SES names, 'Name <addr>' parsing, reply-to, digest off unless exactly 'true', names only in missing", () => {
  const off = getNewsletterConfig({});
  assert.equal(off.enabled, false);
  assert.deepEqual(off.missing.sort(), [
    "AWS_SES_ACCESS_KEY_ID", "AWS_SES_SECRET_ACCESS_KEY", "DATABASE_URL", "NEWSLETTER_FROM",
    "NEWSLETTER_SITE_URL", "NEWSLETTER_TOKEN_SECRET or CRON_SECRET",
  ].sort());
  const on = getNewsletterConfig(ENV);
  assert.equal(on.enabled, true);
  assert.equal(on.from, "news@mail.grwire.com");
  assert.equal(on.fromName, "GR Wire");
  assert.equal(on.replyTo, "d.roussos@tarenosystems.com");
  assert.equal(on.siteUrl, "https://www.grwire.com");
  assert.equal(on.region, "eu-central-1");
  assert.equal(on.digestEnabled, false);
  assert.equal(getNewsletterConfig({ ...ENV, NEWSLETTER_DIGEST_ENABLED: "1" }).digestEnabled, false);
  assert.equal(getNewsletterConfig({ ...ENV, NEWSLETTER_DIGEST_ENABLED: "true" }).digestEnabled, true);
  assert.equal(getNewsletterConfig({ ...ENV, NEWSLETTER_FROM: "news@mail.grwire.com" }).from, "news@mail.grwire.com");
  assert.equal(JSON.stringify(off.missing).includes("SECRET_ACCESS_KEY="), false);
});

test("SigV4: matches an independent computation of the AWS algorithm", () => {
  const now = new Date("2026-10-29T10:00:00Z");
  const body = '{"a":1}';
  const signed = signRequest({ method: "POST", host: "email.eu-central-1.amazonaws.com", path: "/v2/email/outbound-emails", region: "eu-central-1", body, accessKeyId: "AKID", secretAccessKey: "SECRET", now });
  const hash = (d) => createHash("sha256").update(d).digest("hex");
  const h = (k, d) => createHmac("sha256", k).update(d).digest();
  const canonical = ["POST", "/v2/email/outbound-emails", "",
    `content-type:application/json\nhost:email.eu-central-1.amazonaws.com\nx-amz-content-sha256:${hash(body)}\nx-amz-date:20261029T100000Z\n`,
    "content-type;host;x-amz-content-sha256;x-amz-date", hash(body)].join("\n");
  const sts = ["AWS4-HMAC-SHA256", "20261029T100000Z", "20261029/eu-central-1/ses/aws4_request", hash(canonical)].join("\n");
  const key = h(h(h(h("AWS4SECRET", "20261029"), "eu-central-1"), "ses"), "aws4_request");
  const sig = createHmac("sha256", key).update(sts).digest("hex");
  assert.equal(signed.authorization,
    `AWS4-HMAC-SHA256 Credential=AKID/20261029/eu-central-1/ses/aws4_request, SignedHeaders=content-type;host;x-amz-content-sha256;x-amz-date, Signature=${sig}`);
});

test("SES provider: SESv2 raw send, From address only in FromEmailAddress, no secret in body or error", async () => {
  const calls = [];
  const provider = createSesProvider({
    accessKeyId: "AKIAEXAMPLE", secretAccessKey: "SECRETEXAMPLEVALUE", from: "news@mail.grwire.com", fromName: "GR Wire",
    replyTo: "d.roussos@tarenosystems.com", configurationSetName: null,
    fetch: async (url, options) => { calls.push({ url, options }); return { ok: true, status: 200, json: async () => ({ MessageId: "m1" }) }; },
  });
  await provider.send({ to: "reader@example.com", subject: "Επιβεβαιώστε", html: "<p>h</p>", text: "t",
    headers: { "List-Unsubscribe": "<https://x/u>", "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" }, tag: "digest" });
  assert.equal(calls[0].url, "https://email.eu-central-1.amazonaws.com/v2/email/outbound-emails");
  assert.match(calls[0].options.headers.authorization, /^AWS4-HMAC-SHA256 Credential=AKIAEXAMPLE\/\d{8}\/eu-central-1\/ses\/aws4_request/);
  assert.equal("host" in calls[0].options.headers, false);
  const body = JSON.parse(calls[0].options.body);
  assert.equal(body.FromEmailAddress, "news@mail.grwire.com");
  assert.deepEqual(body.EmailTags, [{ Name: "type", Value: "digest" }]);
  assert.equal(JSON.stringify(body).includes("SECRETEXAMPLEVALUE"), false);
  const raw = Buffer.from(body.Content.Raw.Data, "base64").toString("utf8");
  assert.match(raw, /^From: "GR Wire" <news@mail\.grwire\.com>\r\n/);
  assert.match(raw, /Reply-To: d\.roussos@tarenosystems\.com\r\n/);
  assert.match(raw, /List-Unsubscribe: <https:\/\/x\/u>\r\n/);
  assert.match(raw, /List-Unsubscribe-Post: List-Unsubscribe=One-Click\r\n/);
  assert.match(raw, /Subject: =\?UTF-8\?B\?/);
  const failing = createSesProvider({ accessKeyId: "AKIAEXAMPLE", secretAccessKey: "SECRETEXAMPLEVALUE", from: "news@mail.grwire.com",
    fetch: async () => ({ ok: false, status: 403, json: async () => ({ __type: "AccessDeniedException" }) }) });
  await assert.rejects(() => failing.send({ to: "x@e.com", subject: "s", html: "h", text: "t" }), (e) => {
    assert.match(e.message, /403/); assert.doesNotMatch(e.message, /SECRETEXAMPLEVALUE|AKIAEXAMPLE/); return true;
  });
});

test("MIME: refuses header injection through the subject, recipient or headers", () => {
  const base = { from: "news@mail.grwire.com", to: "a@b.co", subject: "s", html: "h", text: "t" };
  assert.throws(() => buildRawEmail({ ...base, subject: "x\r\nBcc: evil@e.com" }), /line break/);
  assert.throws(() => buildRawEmail({ ...base, to: "a@b.co\r\nBcc: e@e.com" }), /line break/);
  assert.throws(() => buildRawEmail({ ...base, headers: { "X-A": "1\nBcc: e@e.com" } }), /line break/);
});

test("emails: Tareno-branded, no provider names, no remote images or tracking, unsubscribe in every email", () => {
  const siteUrl = "https://www.grwire.com";
  const unsubscribeUrl = `${siteUrl}/unsubscribe?token=abc`;
  const stories = [{ title: "Η Cosmote επεκτείνει το FTTH", url: "https://example.gr/a?x=1&y=2", sourceName: "Cosmote", publishedAt: "2026-10-29T03:00:00Z", summary: "Σύντομη περίληψη." }];
  for (const lang of ["el", "en"]) {
    const mails = [
      confirmationEmail({ lang, confirmUrl: `${siteUrl}/api/newsletter/confirm?token=t`, unsubscribeUrl, siteUrl }),
      welcomeEmail({ lang, unsubscribeUrl, siteUrl }),
      digestEmail({ lang, stories, comment: "Ένα σχόλιο <b>", unsubscribeUrl, siteUrl, date: new Date("2026-10-29T06:30:00Z") }),
    ];
    for (const m of mails) {
      assert.match(m.html, /GR WIRE/);
      assert.match(m.html, /Tareno Systems/);
      assert.match(m.text, /Tareno Systems \(tarenosystems\.com\)/);
      assert.match(m.html, new RegExp(`href="${unsubscribeUrl.replace(/[.?]/g, "\\$&")}"`));
      assert.match(m.text, new RegExp(unsubscribeUrl.replace(/[.?]/g, "\\$&")));
      assert.doesNotMatch(m.html + m.text, /resend|mailerlite|amazon|powered by/i);
      assert.doesNotMatch(m.html, /<img\b/i);
      assert.doesNotMatch(m.html, /src="http/i);
    }
  }
  const digest = digestEmail({ lang: "el", stories, comment: "x <script>", unsubscribeUrl, siteUrl });
  assert.doesNotMatch(digest.html, /<script>/);
  assert.match(digest.html, /x=1&amp;y=2/);
  assert.match(confirmationEmail({ lang: "el", confirmUrl: "u", unsubscribeUrl, siteUrl }).subject, /^Επιβεβαιώστε την εγγραφή σας στο GR Wire$/);
  assert.equal(welcomeEmail({ lang: "en", unsubscribeUrl, siteUrl }).subject, "Welcome to GR Wire");
});

test("copy: v2 wording, daily not weekly, no series teaser, controller and 7-day deletion on the privacy page", () => {
  for (const lang of ["el", "en"]) {
    const dump = JSON.stringify(LANDING_COPY[lang]);
    assert.doesNotMatch(dump, /εβδομαδιαί|weekly|one email a week|ένα email την εβδομάδα|Coming soon|Σύντομα"/i);
    assert.equal("series" in LANDING_COPY[lang], false);
    assert.match(JSON.stringify(LANDING_COPY[lang].privacy.details), /Tareno Systems/);
    assert.match(JSON.stringify(LANDING_COPY[lang].privacy.details), /7/);
    assert.match(LANDING_COPY[lang].subscribeForm.consentText, /Tareno Systems/);
  }
  assert.equal(LANDING_COPY.el.hero.headlineMain, "Τηλεπικοινωνίες στην Ελλάδα: δίκτυα σταθερής και κινητής, και δορυφορική επικοινωνία, κάθε πρωί.");
  assert.equal(LANDING_COPY.en.subscribeForm.freeNote, "Free. No ads.");
  assert.equal(LANDING_COPY.el.subscribeForm.freeNote, "Δωρεάν. Χωρίς διαφημίσεις.");
  assert.equal(CONSENT_TEXT_VERSION, "2026-10-29-v2");
  assert.match(CONSENT_TEXT.el, /ημερήσιο email του GR Wire από την Tareno Systems/);
});

test("tokens: unsubscribe token is per address, stable, and independent of case", () => {
  const a = deriveUnsubscribeToken("s", "A@x.com");
  assert.equal(a, deriveUnsubscribeToken("s", "a@x.com"));
  assert.notEqual(a, deriveUnsubscribeToken("s", "b@x.com"));
  assert.notEqual(a, deriveUnsubscribeToken("other", "a@x.com"));
});

function svcSetup() {
  const sent = [];
  const rows = new Map();
  const store = {
    async upsertPending({ email, lang, unsubscribeTokenHash }) { const row = { id: `id-${rows.size + 1}`, email, status: "pending", lang, unsubscribeTokenHash }; rows.set(email, row); return row; },
    async confirmByTokenHash() { const r = [...rows.values()][0]; r.status = "confirmed"; return r; },
  };
  const provider = { async send(m) { sent.push(m); return {}; } };
  const service = createNewsletterService({ store, provider, siteUrl: "https://p.grwire.com", now: () => new Date(), randomToken: () => "rnd",
    unsubscribeTokenFor: (e) => deriveUnsubscribeToken("s", e) });
  return { sent, rows, service };
}

test("service: confirmation carries the branded email and RFC 8058 headers; confirm sends the welcome once; welcome failure does not fail confirm", async () => {
  const { sent, rows, service } = svcSetup();
  await service.subscribe({ email: "Reader@Example.com", lang: "en", consent: "on" });
  const token = deriveUnsubscribeToken("s", "reader@example.com");
  assert.equal(rows.get("reader@example.com").unsubscribeTokenHash, hashToken(token));
  assert.equal(sent.length, 1);
  assert.equal(sent[0].subject, "Confirm your GR Wire subscription");
  assert.equal(sent[0].headers["List-Unsubscribe"], `<https://p.grwire.com/api/newsletter/unsubscribe?token=${encodeURIComponent(token)}>`);
  assert.match(sent[0].html, /GR WIRE/);
  const res = await service.confirm("whatever");
  assert.deepEqual(res, { ok: true, lang: "en" });
  assert.equal(sent.length, 2);
  assert.equal(sent[1].subject, "Welcome to GR Wire");
  assert.ok(sent[1].headers["List-Unsubscribe-Post"]);
  // failing provider: confirm still succeeds
  const failing = svcSetup();
  failing.service = createNewsletterService({ store: { async confirmByTokenHash() { return { id: "1", email: "a@b.co", lang: "el" }; } },
    provider: { async send() { throw new Error("boom"); } }, siteUrl: "https://p", now: () => new Date(), randomToken: () => "r", unsubscribeTokenFor: () => "t" });
  assert.deepEqual(await failing.service.confirm("tok"), { ok: true, lang: "el" });
});

const NOW = Date.parse("2026-10-29T06:30:00Z"); // Thursday
const art = (n, hoursAgo, extra = {}) => ({ url: `https://e.gr/${n}`, title: `T${n}`, sourceName: "S", publishedAt: new Date(NOW - hoursAgo * 3_600_000).toISOString(), summary: null, ...extra });

test("digest: picks homepage stories from the last 24h in page order, deduped, capped", () => {
  const home = { lead: art(1, 2), recent: [art(2, 5), art(1, 2), art(3, 30)], columns: { telco: [art(4, 10), art(5, 23.9), art(6, 25)], energy: [art(7, 1, { publishedAt: null })] } };
  assert.deepEqual(pickDigestStories(home, { now: NOW }).map((s) => s.title), ["T1", "T2", "T4", "T5"]);
  assert.equal(pickDigestStories({ lead: art(1, 1), recent: Array.from({ length: 20 }, (_, i) => art(100 + i, 1)) }, { now: NOW, max: 8 }).length, 8);
  assert.deepEqual(pickDigestStories({}, { now: NOW }), []);
});

test("digest: weekday and Athens date helpers", () => {
  assert.equal(isAthensWeekday(new Date("2026-10-29T06:30:00Z")), true);
  assert.equal(isAthensWeekday(new Date("2026-10-31T06:30:00Z")), false);
  assert.equal(athensDateKey(new Date("2026-10-29T22:30:00Z")), "2026-10-30");
});

function digestHarness(subscribers) {
  const claims = new Map();
  const sends = [];
  const store = {
    async getDigestComment() { return { el: "Σχόλιο", en: null }; },
    async listConfirmed() { return subscribers; },
    async claimDigestSend(id, d) { const k = `${id}|${d}`; if (claims.get(k) && claims.get(k) !== "failed") return false; claims.set(k, "sending"); return true; },
    async markDigestSend(id, d, status) { claims.set(`${id}|${d}`, status); },
  };
  const service = { async sendDigest({ subscriber, stories, comment }) {
    if (subscriber.email.startsWith("bad")) throw new Error("ses 400");
    sends.push({ to: subscriber.email, n: stories.length, comment });
  } };
  return { store, service, sends, claims };
}
const HOME = async () => ({ lead: art(1, 2), recent: [art(2, 3)], columns: {} });

test("digest: off by default, idempotent per day, retries only failed sends, one failure does not stop the batch", async () => {
  const subs = [{ id: "1", email: "a@x.co", lang: "el", status: "confirmed" }, { id: "2", email: "bad@x.co", lang: "en", status: "confirmed" }, { id: "3", email: "c@x.co", lang: "en", status: "confirmed" }];
  const h = digestHarness(subs);
  const now = new Date(NOW);
  assert.deepEqual(await runDigest({ enabled: false, store: h.store, service: h.service, getHome: HOME, now }), { ok: true, skipped: "disabled" });
  assert.equal(h.sends.length, 0);
  const first = await runDigest({ enabled: true, store: h.store, service: h.service, getHome: HOME, now, batchSize: 2 });
  assert.equal(first.sent, 2); assert.equal(first.failed, 1);
  assert.deepEqual(h.sends.map((s) => [s.to, s.comment]), [["a@x.co", "Σχόλιο"], ["c@x.co", null]]);
  const second = await runDigest({ enabled: true, store: h.store, service: h.service, getHome: HOME, now });
  assert.equal(second.sent, 0); assert.equal(second.alreadySent, 2); assert.equal(second.failed, 1);
  assert.equal(h.sends.length, 2, "no subscriber gets the same day's email twice");
  const nextDay = await runDigest({ enabled: true, store: h.store, service: h.service, getHome: HOME, now: new Date(NOW + 86_400_000) });
  assert.equal(nextDay.skipped, "no-stories", "stories older than 24h are not re-sent the next day");
});

test("digest: weekend and empty day send nothing", async () => {
  const h = digestHarness([{ id: "1", email: "a@x.co", lang: "el", status: "confirmed" }]);
  assert.equal((await runDigest({ enabled: true, store: h.store, service: h.service, getHome: HOME, now: new Date("2026-10-31T06:30:00Z") })).skipped, "weekend");
  assert.equal((await runDigest({ enabled: true, store: h.store, service: h.service, getHome: async () => ({ lead: art(1, 40), recent: [], columns: {} }), now: new Date(NOW) })).skipped, "no-stories");
  assert.equal(h.sends.length, 0);
});

test("cron auth: Bearer CRON_SECRET only, and never when the secret is unset", () => {
  const req = (auth) => ({ headers: { get: (n) => (n === "authorization" ? auth : null) } });
  assert.equal(cronAuthorised(req("Bearer s3"), { CRON_SECRET: "s3" }), true);
  assert.equal(cronAuthorised(req("Bearer nope"), { CRON_SECRET: "s3" }), false);
  assert.equal(cronAuthorised(req("Bearer undefined"), {}), false);
  assert.equal(cronAuthorised(req(null), { CRON_SECRET: "s3" }), false);
});
