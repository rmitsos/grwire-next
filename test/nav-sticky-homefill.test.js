import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildNavItems } from "../src/landing/nav.js";
import { NAV_SECTIONS, LANDING_COPY } from "../src/landing/copy.js";
import { LANDING_ROUTES, sectionPath } from "../src/landing/routes.js";
import { insightsIndexPath } from "../src/insights/content.js";
import { summarizeSections, PUBLIC_CATEGORIES } from "../src/public-data.js";
import { PUBLIC_COPY } from "../src/landing/public-copy.js";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => readFileSync(path.join(ROOT, relativePath), "utf8");
const ALL_SHOWN = { tenders: { shown: true }, regulators: { shown: true } };

// --- active tab ------------------------------------------------------------------------------

test("exactly the tab of the current section is marked current, in EL and EN", () => {
  for (const lang of ["el", "en"]) {
    for (const section of NAV_SECTIONS) {
      const items = buildNavItems({ lang, navVisibility: ALL_SHOWN, active: section.slug });
      const current = items.filter((item) => item.current);
      assert.equal(current.length, 1, `${lang}/${section.slug}: one current tab`);
      assert.equal(current[0].key, section.slug);
      assert.equal(current[0].href, sectionPath(lang, section.slug));
    }
  }
});

test("Insights and Search are tabs too, and the homepage marks none", () => {
  for (const lang of ["el", "en"]) {
    const insights = buildNavItems({ lang, navVisibility: ALL_SHOWN, active: "insights" }).filter((item) => item.current);
    assert.deepEqual(insights.map((item) => item.href), [insightsIndexPath(lang)]);
    const search = buildNavItems({ lang, navVisibility: ALL_SHOWN, active: "search" }).filter((item) => item.current);
    assert.deepEqual(search.map((item) => item.href), [LANDING_ROUTES[lang].search]);
    assert.equal(buildNavItems({ lang, navVisibility: ALL_SHOWN }).filter((item) => item.current).length, 0);
  }
});

test("Telecoms is no longer selected by default; held-back sections stay out of the nav", () => {
  const items = buildNavItems({ lang: "el", navVisibility: { tenders: { shown: false }, regulators: { shown: false } }, active: "energy" });
  assert.ok(!items.find((item) => item.key === "tenders"));
  assert.ok(!items.find((item) => item.key === "regulators"));
  assert.equal(items.find((item) => item.key === "telco").current, false);
  assert.equal(items.find((item) => item.key === "energy").current, true);
});

test("the header sets aria-current on the current tab and the pages pass their tab", () => {
  const header = read("src/components/landing/LandingHeader.js");
  assert.ok(header.includes('aria-current={item.current ? "page" : undefined}'));
  assert.ok(header.includes("<NavScrollActive"));
  assert.ok(read("src/components/public/SectionPage.js").includes("active={category}"));
  assert.ok(read("src/components/public/SearchPage.js").includes('active="search"'));
  assert.ok(read("src/components/public/HomePage.js").includes("home"));
  assert.ok(read("src/components/insights/InsightIndexPage.js").includes('active="insights"'));
  assert.ok(read("src/components/insights/InsightArticlePage.js").includes('active="insights"'));
});

// --- sticky header ---------------------------------------------------------------------------

test("the header is sticky on top, opaque, and anchors clear it", () => {
  const css = read("src/app/landing.css");
  assert.match(css, /\.site-header, \.simple-header \{[^}]*position: sticky;[^}]*top: 0;[^}]*z-index: 50;[^}]*background: var\(--paper\)/);
  assert.match(css, /scroll-padding-top: calc\(var\(--header-h\)/);
  assert.match(css, /\.nav-sections a\.current \{[^}]*font-weight: 700/);
  // Phones: the tabs stay reachable as a row that scrolls sideways instead of being hidden.
  assert.ok(!/\.nav-sections \{ visibility: hidden; \}/.test(css));
  assert.ok(!/a:not\(\.primary\) \{ display: none; \}/.test(css));
});

// --- homepage fill ---------------------------------------------------------------------------

test("summarizeSections counts what each section page lists and finds the newest story", () => {
  const summary = summarizeSections({
    telco: [{ publishedAt: "2026-10-27T10:00:00.000Z" }, { publishedAt: "2026-10-28T08:00:00.000Z" }, { publishedAt: null }],
    energy: [],
  });
  assert.deepEqual(Object.keys(summary).sort(), Object.keys(PUBLIC_CATEGORIES).sort());
  assert.equal(summary.telco.count, 3);
  assert.equal(summary.telco.latestAt, "2026-10-28T08:00:00.000Z");
  assert.deepEqual(summary.energy, { count: 0, latestAt: null });
  assert.deepEqual(summary.deals, { count: 0, latestAt: null });
});

test("the sign-up band uses the approved scope line in both languages", () => {
  assert.equal(LANDING_COPY.el.scopeLine, "Τηλεπικοινωνίες στην Ελλάδα: δίκτυα σταθερής και κινητής, και δορυφορική επικοινωνία");
  assert.equal(LANDING_COPY.en.scopeLine, "Telecoms in Greece: fixed and mobile networks, and satellite communications");
  assert.deepEqual(Object.keys(PUBLIC_COPY.el.home), Object.keys(PUBLIC_COPY.en.home));
});

test("the homepage fill adds no stories: it reuses sections, Insights, principles and the newsletter", () => {
  const home = read("src/components/public/HomePage.js");
  assert.ok(home.includes("sectionSummary") && home.includes("listInsights") && home.includes("howWeWork"));
  assert.ok(home.includes("<SubscribeForm") && home.includes("getNewsletterConfig().enabled"));
  // Stories still come only from buildHomepageSections (once each, under their main section).
  assert.equal((home.match(/<WireList/g) ?? []).length, 2);
  assert.ok(!home.includes("data.articles"));
});
