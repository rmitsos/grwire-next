import test from "node:test";
import assert from "node:assert/strict";
import { buildLandingMetadata, siteBase } from "../src/landing/metadata.js";
import { LANDING_COPY, NAV_SECTIONS } from "../src/landing/copy.js";
import { LANDING_ROUTES, otherLang } from "../src/landing/routes.js";

const FORBIDDEN_SUBSTRINGS = ["/tenders", "/regulators", "hello@grwire.com"];

test("buildLandingMetadata: EL canonical, hreflang alternates (incl. x-default), og locale", () => {
  const base = siteBase();
  const metadata = buildLandingMetadata({
    lang: "el",
    routeKey: "subscribe",
    title: "Title",
    description: "Description",
  });

  assert.equal(metadata.metadataBase.toString(), `${base}/`);
  assert.equal(metadata.alternates.canonical, `${base}/subscribe`);
  assert.deepEqual(metadata.alternates.languages, {
    el: `${base}/subscribe`,
    en: `${base}/en/subscribe`,
    "x-default": `${base}/subscribe`,
  });
  assert.equal(metadata.openGraph.url, `${base}/subscribe`);
  assert.equal(metadata.openGraph.siteName, "GR Wire");
  assert.equal(metadata.openGraph.locale, "el_GR");
  assert.equal(metadata.openGraph.alternateLocale, "en_GB");
  assert.equal(metadata.openGraph.type, "website");
  assert.equal(metadata.robots, undefined);
  assert.equal(metadata.twitter, undefined);
});

test("buildLandingMetadata: EN canonical points at /en/..., x-default still points at the EL page", () => {
  const base = siteBase();
  const metadata = buildLandingMetadata({
    lang: "en",
    routeKey: "privacy",
    title: "Title",
    description: "Description",
  });

  assert.equal(metadata.alternates.canonical, `${base}/en/privacy`);
  assert.equal(metadata.alternates.languages["x-default"], `${base}/privacy`);
  assert.equal(metadata.alternates.languages.el, `${base}/privacy`);
  assert.equal(metadata.alternates.languages.en, `${base}/en/privacy`);
  assert.equal(metadata.openGraph.locale, "en_GB");
  assert.equal(metadata.openGraph.alternateLocale, "el_GR");
});

test("buildLandingMetadata: noindex sets robots, image sets openGraph.images and a twitter card", () => {
  const noindexed = buildLandingMetadata({
    lang: "el",
    routeKey: "unsubscribe",
    title: "T",
    description: "D",
    noindex: true,
  });
  assert.deepEqual(noindexed.robots, { index: false, follow: false });

  const base = siteBase();
  const withImage = buildLandingMetadata({
    lang: "el",
    routeKey: "subscribe",
    title: "T",
    description: "D",
    image: `${base}/og/subscribe.png`,
  });
  assert.deepEqual(withImage.openGraph.images, [{ url: `${base}/og/subscribe.png` }]);
  assert.equal(withImage.twitter.card, "summary_large_image");
  assert.deepEqual(withImage.twitter.images, [`${base}/og/subscribe.png`]);
});

test("otherLang swaps el/en", () => {
  assert.equal(otherLang("el"), "en");
  assert.equal(otherLang("en"), "el");
});

test("LANDING_ROUTES: EL has no prefix, EN is prefixed with /en, routeKeys match 1:1", () => {
  assert.deepEqual(Object.keys(LANDING_ROUTES.el).sort(), Object.keys(LANDING_ROUTES.en).sort());
  for (const [key, path] of Object.entries(LANDING_ROUTES.el)) {
    assert.ok(!path.startsWith("/en"), `EL route ${key} should not be prefixed: ${path}`);
  }
  for (const [key, path] of Object.entries(LANDING_ROUTES.en)) {
    assert.ok(path.startsWith("/en/"), `EN route ${key} should be prefixed: ${path}`);
  }
});

test("NAV_SECTIONS only link to public routes that actually exist (no /regulators or /tenders)", () => {
  const paths = NAV_SECTIONS.map((section) => section.path);
  assert.deepEqual(paths.sort(), ["/deals-companies", "/energy", "/infrastructure", "/telco"]);
  assert.equal(NAV_SECTIONS.filter((section) => section.primary).length, 1);
});

// Every key present on one language's copy tree must exist on the other's, with the same shape
// (same array lengths), so a translator can never add a field to one language and forget the
// other. Leaf string/number values are intentionally not compared — only structure.
function assertSameShape(a, b, path = "copy") {
  if (Array.isArray(a) || Array.isArray(b)) {
    assert.ok(Array.isArray(a) && Array.isArray(b), `${path}: both sides must be arrays`);
    assert.equal(a.length, b.length, `${path}: arrays differ in length`);
    a.forEach((item, index) => assertSameShape(item, b[index], `${path}[${index}]`));
    return;
  }
  if (a && typeof a === "object" && b && typeof b === "object") {
    const aKeys = Object.keys(a).sort();
    const bKeys = Object.keys(b).sort();
    assert.deepEqual(aKeys, bKeys, `${path}: key sets differ (EL: ${aKeys}, EN: ${bKeys})`);
    for (const key of aKeys) assertSameShape(a[key], b[key], `${path}.${key}`);
  }
}

test("LANDING_COPY: every EL key has an EN counterpart and vice versa", () => {
  assertSameShape(LANDING_COPY.el, LANDING_COPY.en);
});

test("LANDING_COPY: lang field matches each language's own key", () => {
  assert.equal(LANDING_COPY.el.lang, "el");
  assert.equal(LANDING_COPY.en.lang, "en");
});

test("Landing copy and routes never reference /tenders, /regulators or hello@grwire.com", () => {
  const serialized = JSON.stringify({ LANDING_COPY, NAV_SECTIONS, LANDING_ROUTES });
  for (const forbidden of FORBIDDEN_SUBSTRINGS) {
    assert.ok(!serialized.includes(forbidden), `found forbidden reference: ${forbidden}`);
  }
});

test("subscribe route: redirect target follows lang (env unset -> unavailable, no DB touched)", async () => {
  const keys = ["RESEND_API_KEY", "NEWSLETTER_FROM", "NEWSLETTER_SITE_URL", "DATABASE_URL"];
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  for (const key of keys) delete process.env[key];

  try {
    const { POST } = await import("../src/app/api/newsletter/subscribe/route.js");

    const elRequest = new Request("https://www.grwire.com/api/newsletter/subscribe", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: "email=a@example.com&lang=el&consent=on",
    });
    const elResponse = await POST(elRequest);
    assert.equal(elResponse.status, 303);
    assert.equal(
      elResponse.headers.get("location"),
      "https://www.grwire.com/subscribe?status=unavailable#subscribe",
    );

    const enRequest = new Request("https://www.grwire.com/api/newsletter/subscribe", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: "email=a@example.com&lang=en&consent=on",
    });
    const enResponse = await POST(enRequest);
    assert.equal(enResponse.status, 303);
    assert.equal(
      enResponse.headers.get("location"),
      "https://www.grwire.com/en/subscribe?status=unavailable#subscribe",
    );
  } finally {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
});
