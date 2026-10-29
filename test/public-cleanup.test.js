import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { stripTrackingParams, cleanOutgoingLink, unwrapGoogleNewsUrl, publicSourceName, readFeedSummary } from "../src/public-links.js";
import { selectArticles, navVisibilityFromRows, PUBLIC_CATEGORIES } from "../src/public-data.js";
import { PUBLIC_COPY, getPublicCopy, sectionTitle } from "../src/landing/public-copy.js";
import { LANDING_ROUTES, sectionPath } from "../src/landing/routes.js";
import { LANDING_COPY, NAV_SECTIONS } from "../src/landing/copy.js";
import { buildPublicSitemapEntries } from "../src/app/sitemap.js";
import robots from "../src/app/robots.js";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => readFileSync(path.join(ROOT, relativePath), "utf8");

// Fixed timestamps: rows sharing a score are ordered by publish time, so a default taken from
// `new Date()` (millisecond-different per call) made the order of same-score rows non-deterministic.
const FIXED_PUBLISHED_AT = "2026-10-28T10:00:00.000Z";

function row({ url, title, sourceId = "src-x", publishedAt = FIXED_PUBLISHED_AT, metadata = {}, summary = "" }) {
  return {
    canonical_url: url, title, summary, published_at: publishedAt,
    source_id: sourceId, source_url: url, score: 77, categories: [], relevance: [], metadata,
  };
}

// --- links ------------------------------------------------------------------

test("stripTrackingParams removes utm_*/click ids and keeps real params and the fragment", () => {
  assert.equal(
    stripTrackingParams("https://example.gr/a?utm_source=x&utm_medium=y&id=3&fbclid=abc&gclid=1#part"),
    "https://example.gr/a?id=3#part",
  );
  assert.equal(stripTrackingParams("https://example.gr/a?utm_campaign=z"), "https://example.gr/a");
  assert.equal(stripTrackingParams("not a url"), "not a url");
});

test("cleanOutgoingLink unwraps Google News when the original URL is in the data, else flags it", () => {
  const withOriginal = cleanOutgoingLink("https://news.google.com/rss/articles/CBMi123", {
    originalUrl: "https://www.capital.gr/a?utm_source=rss&id=9",
  });
  assert.deepEqual(withOriginal, { url: "https://www.capital.gr/a?id=9", viaGoogleNews: false, unwrapped: true });

  const viaParam = cleanOutgoingLink("https://www.google.com/url?q=https%3A%2F%2Fx.gr%2Fp%3Futm_a%3D1&sa=U");
  assert.equal(viaParam.url, "https://x.gr/p");

  const legacy = Buffer.from("\x08\x13\x22\x1ahttps://www.capital.gr/a/b?utm_medium=z\xd2\x01\x00").toString("base64url");
  assert.equal(cleanOutgoingLink(`https://news.google.com/rss/articles/${legacy}?oc=5`).url, "https://www.capital.gr/a/b");
  assert.ok(unwrapGoogleNewsUrl(`https://news.google.com/rss/articles/${legacy}?oc=5`).startsWith("https://www.capital.gr/a/b"));

  const opaque = cleanOutgoingLink("https://news.google.com/rss/articles/CBMiOpaqueEncryptedToken?oc=5", { publisher: "Capital.gr" });
  assert.equal(opaque.viaGoogleNews, true);
  assert.equal(opaque.unwrapped, false);
});

test("publicSourceName prefers the publisher, never returns news.google.com or an id", () => {
  assert.equal(publicSourceName({ publisher: "Capital.gr", url: "https://news.google.com/x" }), "Capital.gr");
  assert.equal(publicSourceName({ url: "https://news.google.com/x" }), null);
  assert.equal(publicSourceName({ url: "https://www.naftemporiki.gr/a" }), "naftemporiki.gr");
});

test("public articles: clean link, ' - Source' title suffix stripped, source name shown", () => {
  const rows = [row({
    url: "https://www.capital.gr/x/story?utm_source=rss&utm_medium=feed",
    title: "Η Cosmote επεκτείνει το δίκτυο FTTH σε νέους δήμους - Capital.gr",
    publishedAt: "2026-10-28T10:00:00.000Z",
    metadata: { publisher: "Capital.gr" },
  }), row({
    url: "https://news.google.com/rss/articles/CBMiOpaque?oc=5",
    title: "Η Nova επεκτείνει το δίκτυο FTTH σε νέους δήμους – Insider.gr",
    sourceId: "src-y",
    publishedAt: "2026-10-28T09:00:00.000Z",
    // Resolvable (original URL in the data): shown with the publisher link; an unresolvable one is dropped (round 7).
    metadata: { publisher: "Insider.gr", originalUrl: "https://www.insider.gr/story/nova-ftth?utm_source=rss" },
  })];
  const articles = selectArticles(rows, { category: "telco" });
  assert.equal(articles.length, 2);
  const [first, second] = articles;
  assert.equal(first.url, "https://www.capital.gr/x/story");
  assert.equal(first.title, "Η Cosmote επεκτείνει το δίκτυο FTTH σε νέους δήμους");
  assert.equal(first.sourceName, "Capital.gr");
  assert.equal(first.viaGoogleNews, false);
  assert.equal(second.title, "Η Nova επεκτείνει το δίκτυο FTTH σε νέους δήμους");
  assert.equal(second.url, "https://www.insider.gr/story/nova-ftth");
  assert.equal(second.viaGoogleNews, false);
  assert.equal(second.sourceName, "Insider.gr");
});

// --- nav / sitemap -----------------------------------------------------------

test("nav visibility counts what the section page lists (same selection, same rows)", () => {
  const now = Date.now();
  const tenderRow = (n) => row({
    url: `https://www.promitheus.gov.gr/t${n}`,
    title: `Διαγωνισμός ${n} για δίκτυο οπτικών ινών FTTH – προκήρυξη`,
    sourceId: `kimdis-${n}`,
    publishedAt: new Date(now - n * 3_600_000).toISOString(),
    metadata: {},
  });
  const hidden = navVisibilityFromRows([tenderRow(1), tenderRow(2)], { now });
  assert.equal(hidden.tenders.shown, false);
  assert.equal(hidden.regulators.shown, false);
  const none = navVisibilityFromRows([], { now });
  assert.deepEqual([none.tenders.shown, none.regulators.shown], [false, false]);
});

test("sitemap lists both languages for every page and hides tenders/regulators under 3 items", () => {
  const base = "https://example.test";
  const hidden = buildPublicSitemapEntries(base, { tenders: { shown: false }, regulators: { shown: false } });
  const urls = hidden.map((entry) => entry.url);
  for (const url of [`${base}/`, `${base}/en`, `${base}/telco`, `${base}/en/telco`, `${base}/deals`, `${base}/en/search`]) {
    assert.ok(urls.includes(url) || urls.includes(url.replace(/\/$/, "")), `sitemap should list ${url}`);
  }
  assert.ok(!urls.some((url) => /tenders|regulators/.test(url)));
  const shown = buildPublicSitemapEntries(base, { tenders: { shown: true }, regulators: { shown: false } });
  assert.ok(shown.some((entry) => entry.url === `${base}/tenders`));
  assert.ok(shown.some((entry) => entry.url === `${base}/en/tenders`));
  assert.ok(!shown.some((entry) => entry.url.includes("regulators")));
  const home = hidden.find((entry) => entry.url === `${base}${LANDING_ROUTES.el.home}`);
  assert.equal(home.alternates.languages.en, `${base}/en`);
  assert.ok(robots().rules.disallow.includes("/en/search?"));
});

// --- shell / routes ----------------------------------------------------------

test("every public page exists in EL and EN on the landing shell, with canonical+hreflang metadata", () => {
  const pairs = [
    ["src/app/(landing-el)/page.js", "src/app/(landing-en)/en/page.js"],
    ["src/app/(landing-el)/[category]/page.js", "src/app/(landing-en)/en/[category]/page.js"],
    ["src/app/(landing-el)/search/page.js", "src/app/(landing-en)/en/search/page.js"],
  ];
  for (const files of pairs) {
    for (const file of files) {
      assert.ok(existsSync(path.join(ROOT, file)), `${file} should exist`);
      assert.ok(read(file).includes("buildAlternatesMetadata"), `${file} should set canonical + hreflang`);
    }
  }
  assert.equal(LANDING_ROUTES.el.home, "/");
  assert.equal(LANDING_ROUTES.en.home, "/en");
  assert.equal(sectionPath("el", "telco"), "/telco");
  assert.equal(sectionPath("en", "telco"), "/en/telco");
  // The old English-only (site)/(public) shell is gone; /intelligence and /login stay in (site).
  assert.ok(!existsSync(path.join(ROOT, "src/app/(site)/(public)")));
  assert.ok(existsSync(path.join(ROOT, "src/app/(site)/intelligence")));
});

test("every page passes the same page in the other language to the language toggle", () => {
  const shell = read("src/components/public/PublicShell.js");
  assert.ok(shell.includes("elHref") && shell.includes("enHref"));
  assert.ok(read("src/components/public/HomePage.js").includes("LANDING_ROUTES.en.home"));
  assert.ok(read("src/components/public/SectionPage.js").includes('sectionPath("en", category)'));
  assert.ok(read("src/components/public/SearchPage.js").includes("LANDING_ROUTES.en.search"));
  const header = read("src/components/landing/LandingHeader.js");
  assert.ok(header.includes("getNavVisibility"), "header hides held-back sections");
});

test("public copy has the same shape in EL and EN, with the neutral empty-section message", () => {
  const shape = (value) => (typeof value === "object" && value !== null && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value).map(([key, inner]) => [key, shape(inner)]))
    : typeof value);
  assert.deepEqual(shape(PUBLIC_COPY.el), shape(PUBLIC_COPY.en));
  assert.equal(getPublicCopy("el").empty, "Δεν υπάρχουν ακόμη ειδήσεις σε αυτήν την ενότητα.");
  assert.equal(getPublicCopy("en").empty, "No stories in this section yet.");
  for (const slug of Object.keys(PUBLIC_CATEGORIES)) {
    assert.ok(PUBLIC_COPY.el.sectionDecks[slug] && PUBLIC_COPY.en.sectionDecks[slug]);
    assert.ok(sectionTitle(slug, "el") && sectionTitle(slug, "en"));
  }
  assert.equal(NAV_SECTIONS.length, Object.keys(PUBLIC_CATEGORIES).length);
});

// --- nothing internal on the public pages ------------------------------------

test("public components never render scores, source ids, or the private-dashboard hints", () => {
  const files = [
    "src/components/public/HomePage.js", "src/components/public/SectionPage.js", "src/components/public/SearchPage.js",
    "src/components/public/WireList.js", "src/components/public/PublicShell.js", "src/components/DailyStory.js",
    "src/components/landing/LandingHeader.js", "src/components/landing/LandingFooter.js",
    "src/components/landing/SubscribePage.js", "src/landing/public-copy.js", "src/landing/copy.js",
  ];
  const forbidden = [/\.score\b/, /\.sourceId\b/, /source_id/, /confidence/i, /relevance/i, /private intelligence/i,
    /first scan/i, /SYSTEM READY/, /Scan now/i, /\/intelligence/];
  for (const file of files) {
    const content = read(file);
    for (const pattern of forbidden) assert.ok(!pattern.test(content), `${file} must not match ${pattern}`);
  }
  assert.equal(LANDING_COPY.el.hero.signupClosed.length > 0, true);
});

test("the homepage has no DailyStory block", () => {
  assert.ok(!read("src/components/public/HomePage.js").includes("DailyStory"));
});

test("subscribe page swaps the dead form for an honest notice while the newsletter is not configured", () => {
  const page = read("src/components/landing/SubscribePage.js");
  assert.ok(page.includes("getNewsletterConfig().enabled"));
  assert.ok(page.includes("signup-closed"));
  assert.ok(!/starts soon|ξεκινά σύντομα/i.test(LANDING_COPY.el.hero.teaserNote + LANDING_COPY.en.hero.teaserNote));
});

test("Google News feed summaries: entities decoded, repeated title dropped, publisher confirmed by the title tail", () => {
  const title = "Αγορά δύο ταχυτήτων - Μεγάλος κυρίαρχος ο ΟΤΕ - Moneyreview.gr";
  const summary = "Αγορά δύο ταχυτήτων - Μεγάλος κυρίαρχος ο ΟΤΕ &nbsp;&nbsp; Moneyreview.gr";
  assert.deepEqual(readFeedSummary(title, summary), { summary: null, publisher: "Moneyreview.gr" });
  const withBody = readFeedSummary("Deal closes - Reuters", "The buyer pays EUR 1bn.  Reuters");
  assert.equal(withBody.summary, "The buyer pays EUR 1bn.");
  assert.equal(withBody.publisher, "Reuters");
  // A trailing segment the title does not confirm is not taken as a publisher.
  assert.equal(readFeedSummary("Plain title", "Body text  Someone").publisher, null);
  assert.equal(readFeedSummary("t", "a &amp;nbsp; b").summary, "a b");
});
