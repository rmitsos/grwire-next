import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import {
  INSIGHT_ORDER,
  INSIGHT_LANGS,
  getInsight,
  listInsights,
  parseInsight,
  insightPath,
  insightsIndexPath,
  insightStaticParams,
} from "../src/insights/content.js";
import { buildAlternatesMetadata, siteBase } from "../src/landing/metadata.js";
import { LANDING_COPY } from "../src/landing/copy.js";
import sitemap from "../src/app/sitemap.js";

const REPO_ROOT = path.join(import.meta.dirname, "..");
const KNOWLEDGE_DIR = "/workspace/knowledge/grwire/insights";

const EXPECTED = {
  "fibre-switch:en": {
    title: "Fibre costs about the same as VDSL. About one in three homes that can get it have it",
    standfirst: [
      "The fibre networks keep growing and, at several operators, a fibre plan is now priced close to VDSL or below it.",
      "Take-up is rising too, but more slowly than the networks. This piece looks at that gap and at the reasons it might have, without claiming to know which one matters most.",
    ],
    sourcesCount: 9,
    chartSrc: "/insights/02-fibre-chart.png",
  },
  "fibre-switch:el": {
    title: "Η ίνα κοστίζει πια περίπου όσο το VDSL. Την έχει περίπου ένα στα τρία σπίτια με κάλυψη",
    standfirst: [
      "Τα δίκτυα οπτικής ίνας μεγαλώνουν και σε αρκετούς παρόχους ένα πακέτο ίνας κοστίζει πια περίπου όσο ένα VDSL ή και λιγότερο.",
      "Οι συνδέσεις αυξάνονται κι αυτές, αλλά πιο αργά από τα δίκτυα. Εδώ εξετάζουμε αυτή την απόσταση και τις πιθανές αιτίες της, χωρίς να ισχυριζόμαστε ότι ξέρουμε ποια μετράει περισσότερο.",
    ],
    sourcesCount: 9,
    chartSrc: "/insights/02-fibre-chart.el.png",
  },
  "ai-greek-smes:en": {
    title: "AI has reached Greek SMEs, but not yet their daily work",
    standfirst: [
      "Two surveys published in October 2026 both put AI use among Greek businesses at 47%.",
      "Far fewer have made it part of normal operations with measurable results: 10% of SMEs with 10–50 staff.",
      "The most useful finding is the gap between \"we've tried it\" and \"we use it every day\".",
    ],
    sourcesCount: 3,
    chartSrc: null,
  },
  "ai-greek-smes:el": {
    title: "Η τεχνητή νοημοσύνη μπήκε στις μικρομεσαίες. Στην καθημερινή δουλειά, όχι ακόμη",
    standfirst: [
      "Δύο έρευνες του Οκτωβρίου 2026 καταγράφουν χρήση AI στο 47% των ελληνικών επιχειρήσεων.",
      "Σε ελάχιστες όμως έχει γίνει μέρος της κανονικής λειτουργίας με αποτελέσματα που μετριούνται: στο 10% των ΜμΕ με 10–50 εργαζόμενους.",
      "Το κενό ανάμεσα στο «το δοκιμάσαμε» και στο «το χρησιμοποιούμε κάθε μέρα» είναι το πιο χρήσιμο εύρημα.",
    ],
    sourcesCount: 3,
    chartSrc: null,
  },
};

for (const [key, expected] of Object.entries(EXPECTED)) {
  const [slug, lang] = key.split(":");

  test(`loader: ${key} parses title, standfirst, sources, date, draft`, () => {
    const insight = getInsight(slug, lang);
    assert.ok(insight, `${key} should load`);
    assert.equal(insight.title, expected.title);
    assert.deepEqual(insight.standfirst, expected.standfirst);
    assert.equal(insight.sources.length, expected.sourcesCount);
    assert.equal(insight.date, null);
    assert.equal(insight.draft, true);

    const serialized = JSON.stringify(insight);
    assert.ok(!serialized.includes("<!--"));
    assert.ok(!serialized.includes("Σημειώσεις σύνταξης"));
    assert.ok(!serialized.includes("not published"));
  });

  test(`loader: ${key} chart`, () => {
    const insight = getInsight(slug, lang);
    if (expected.chartSrc) {
      assert.equal(insight.chart.src, expected.chartSrc);
      const serializedBody = JSON.stringify(insight.body);
      assert.ok(!serializedBody.includes("Bar chart"));
      assert.ok(!serializedBody.includes("Ραβδόγραμμα"));
    } else {
      assert.equal(insight.chart, null);
    }
  });
}

test("loader: fibre-switch sources #7 and #8 have url null (both languages)", () => {
  for (const lang of ["en", "el"]) {
    const insight = getInsight("fibre-switch", lang);
    assert.equal(insight.sources[6].url, null);
    assert.equal(insight.sources[7].url, null);
  }
});

test("listInsights: order is fibre-switch then ai-greek-smes, in both languages", () => {
  assert.deepEqual(listInsights("el").map((i) => i.slug), ["fibre-switch", "ai-greek-smes"]);
  assert.deepEqual(listInsights("en").map((i) => i.slug), ["fibre-switch", "ai-greek-smes"]);
});

test("insightPath / insightsIndexPath", () => {
  assert.equal(insightPath("fibre-switch", "el"), "/insights/fibre-switch");
  assert.equal(insightPath("fibre-switch", "en"), "/en/insights/fibre-switch");
  assert.equal(insightsIndexPath("el"), "/insights");
  assert.equal(insightsIndexPath("en"), "/en/insights");
});

test("insightStaticParams returns both slugs for both languages", () => {
  assert.deepEqual(insightStaticParams("el"), [{ slug: "fibre-switch" }, { slug: "ai-greek-smes" }]);
  assert.deepEqual(insightStaticParams("en"), [{ slug: "fibre-switch" }, { slug: "ai-greek-smes" }]);
});

test("every INSIGHT_ORDER slug has a content file in every INSIGHT_LANGS language", () => {
  for (const slug of INSIGHT_ORDER) {
    for (const lang of INSIGHT_LANGS) {
      assert.ok(getInsight(slug, lang), `${slug}.${lang} should exist`);
    }
  }
});

test("content/insights files are byte-identical to /workspace/knowledge/grwire/insights, where present", () => {
  if (!existsSync(KNOWLEDGE_DIR)) return; // not present in every environment — skip rather than fail
  const contentDir = path.join(REPO_ROOT, "content", "insights");
  for (const name of readdirSync(contentDir)) {
    const knowledgePath = path.join(KNOWLEDGE_DIR, name);
    if (!existsSync(knowledgePath)) continue;
    assert.equal(
      readFileSync(path.join(contentDir, name)).toString("utf8"),
      readFileSync(knowledgePath).toString("utf8"),
      `${name} should be byte-identical to the knowledge copy`,
    );
  }
});

// ---- parseInsight unit cases ------------------------------------------------------------------

const SYNTHETIC_MD = `**INSIGHT · TEST**

# Test title

Standfirst line one.
Standfirst line two.

---

## Section one

A paragraph with **bold**, *italic*, \`code\`, a [link](https://example.com) and a bare https://example.org url.

| A | B |
|---|---|
| 1 | 2 |

## Sources

1. First source https://a.example.com
2. Second source without url

*Method: test method text.*
`;

test("parseInsight: title, standfirst, table, inline bold/italic/code/link/bare-url", () => {
  const insight = parseInsight(SYNTHETIC_MD, { slug: "synthetic", lang: "en" });
  assert.equal(insight.title, "Test title");
  assert.deepEqual(insight.standfirst, ["Standfirst line one.", "Standfirst line two."]);

  const table = insight.body.find((block) => block.type === "table");
  assert.ok(table);
  assert.deepEqual(table.header.map((cell) => cell.map((n) => n.v).join("")), ["A", "B"]);
  assert.deepEqual(table.rows[0].map((cell) => cell.map((n) => n.v).join("")), ["1", "2"]);

  const paragraph = insight.body.find((block) => block.type === "paragraph");
  assert.ok(paragraph);
  assert.ok(paragraph.text.some((n) => n.t === "bold" && n.v === "bold"));
  assert.ok(paragraph.text.some((n) => n.t === "italic" && n.v === "italic"));
  assert.ok(paragraph.text.some((n) => n.t === "code" && n.v === "code"));
  assert.ok(paragraph.text.some((n) => n.t === "link" && n.text === "link" && n.url === "https://example.com"));
  assert.ok(paragraph.text.some((n) => n.t === "link" && n.url === "https://example.org"));
});

test("parseInsight: ordered list with and without a trailing URL (Sources)", () => {
  const insight = parseInsight(SYNTHETIC_MD, { slug: "synthetic", lang: "en" });
  assert.equal(insight.sourcesHeading, "Sources");
  assert.deepEqual(insight.sources, [
    { text: "First source", url: "https://a.example.com" },
    { text: "Second source without url", url: null },
  ]);
  assert.equal(insight.method, "Method: test method text.");
});

test("parseInsight: draft detection from the first HTML comment only", () => {
  const draftMd = `<!-- DRAFT -->\n\n**K**\n\n# T\n\nStandfirst.\n\n## Sources\n\n1. S\n`;
  const notDraftMd = `<!-- checked -->\n\n**K**\n\n# T\n\nStandfirst.\n\n## Sources\n\n1. S\n`;
  const greekDraftMd = `<!-- ΠΡΟΣΧΕΔΙΟ -->\n\n**K**\n\n# T\n\nStandfirst.\n\n## Sources\n\n1. S\n`;
  assert.equal(parseInsight(draftMd, { slug: "s", lang: "en" }).draft, true);
  assert.equal(parseInsight(notDraftMd, { slug: "s", lang: "en" }).draft, false);
  assert.equal(parseInsight(greekDraftMd, { slug: "s", lang: "en" }).draft, true);
});

// ---- metadata -----------------------------------------------------------------------------

test("buildAlternatesMetadata: article canonical/hreflang/x-default/og for an explicit path pair", () => {
  const base = siteBase();
  const metadata = buildAlternatesMetadata({
    lang: "el",
    elPath: "/insights/fibre-switch",
    enPath: "/en/insights/fibre-switch",
    title: "Title",
    description: "Description",
    image: `${base}/insights/02-fibre-chart.el.png`,
    type: "article",
  });

  assert.equal(metadata.alternates.canonical, `${base}/insights/fibre-switch`);
  assert.deepEqual(metadata.alternates.languages, {
    el: `${base}/insights/fibre-switch`,
    en: `${base}/en/insights/fibre-switch`,
    "x-default": `${base}/insights/fibre-switch`,
  });
  assert.equal(metadata.openGraph.type, "article");
  assert.deepEqual(metadata.openGraph.images, [{ url: `${base}/insights/02-fibre-chart.el.png` }]);
  assert.equal(metadata.twitter.card, "summary_large_image");
  assert.equal(metadata.robots, undefined);

  const enVersion = buildAlternatesMetadata({
    lang: "en",
    elPath: "/insights/fibre-switch",
    enPath: "/en/insights/fibre-switch",
    title: "Title",
    description: "Description",
  });
  assert.equal(enVersion.alternates.canonical, `${base}/en/insights/fibre-switch`);
  assert.equal(enVersion.alternates.languages["x-default"], `${base}/insights/fibre-switch`);
});

// ---- sitemap -----------------------------------------------------------------------------

test("sitemap includes the insights index and articles in both languages, with alternates", () => {
  const base = siteBase();
  const entries = sitemap();
  const byUrl = Object.fromEntries(entries.map((entry) => [entry.url, entry]));

  assert.ok(byUrl[`${base}/insights`]);
  assert.deepEqual(byUrl[`${base}/insights`].alternates.languages, {
    el: `${base}/insights`,
    en: `${base}/en/insights`,
  });

  assert.ok(byUrl[`${base}/en/insights`]);
  assert.deepEqual(byUrl[`${base}/en/insights`].alternates.languages, {
    el: `${base}/insights`,
    en: `${base}/en/insights`,
  });

  assert.ok(byUrl[`${base}/insights/fibre-switch`]);
  assert.deepEqual(byUrl[`${base}/insights/fibre-switch`].alternates.languages, {
    el: `${base}/insights/fibre-switch`,
    en: `${base}/en/insights/fibre-switch`,
  });

  assert.ok(byUrl[`${base}/en/insights/fibre-switch`]);
  assert.deepEqual(byUrl[`${base}/en/insights/fibre-switch`].alternates.languages, {
    el: `${base}/insights/fibre-switch`,
    en: `${base}/en/insights/fibre-switch`,
  });
});

// ---- landing copy --------------------------------------------------------------------------

test("landing copy: hero.fromLinkedIn exists verbatim in both languages", () => {
  assert.deepEqual(LANDING_COPY.el.hero.fromLinkedIn, {
    before: "Ήρθατε από μια ανάρτηση στο LinkedIn; Η πλήρης ανάλυση βρίσκεται ",
    link: "εδώ →",
    after: ".",
  });
  assert.deepEqual(LANDING_COPY.en.hero.fromLinkedIn, {
    before: "Came from a LinkedIn post? The full analysis is ",
    link: "here →",
    after: ".",
  });
});

// ---- route files ---------------------------------------------------------------------------

test("insight route files exist and generate static params for both slugs", () => {
  const routeFiles = [
    "src/app/(landing-el)/insights/page.js",
    "src/app/(landing-el)/insights/[slug]/page.js",
    "src/app/(landing-en)/en/insights/page.js",
    "src/app/(landing-en)/en/insights/[slug]/page.js",
  ];
  for (const relativePath of routeFiles) {
    const fullPath = path.join(REPO_ROOT, relativePath);
    assert.ok(existsSync(fullPath), `${relativePath} should exist`);
  }

  const slugPages = [
    "src/app/(landing-el)/insights/[slug]/page.js",
    "src/app/(landing-en)/en/insights/[slug]/page.js",
  ];
  for (const relativePath of slugPages) {
    const content = readFileSync(path.join(REPO_ROOT, relativePath), "utf8");
    assert.ok(content.includes("dynamicParams = false"));
    assert.ok(content.includes("insightStaticParams"));
  }

  assert.deepEqual(insightStaticParams("el"), [{ slug: "fibre-switch" }, { slug: "ai-greek-smes" }]);
  assert.deepEqual(insightStaticParams("en"), [{ slug: "fibre-switch" }, { slug: "ai-greek-smes" }]);
});
