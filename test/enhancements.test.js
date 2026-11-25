import test from "node:test";
import assert from "node:assert/strict";
import {
  TedSourceAdapter,
  DiavgeiaSourceAdapter,
  humanizeDiavgeiaSubject,
  createSourceAdapter,
  DEFAULT_WATCH_RULES,
  rankItems,
  sourceForcedCategories,
  detectArticleOrganizations,
  hasTier1ActionWord,
} from "../src/index.js";
import { SOURCES } from "../config/sources.js";
import { extractTrendingEntities, selectArticles, buildHomepageSections } from "../src/public-data.js";

test("createSourceAdapter supports ted and diavgeia adapters", () => {
  assert.ok(createSourceAdapter("ted") instanceof TedSourceAdapter);
  assert.ok(createSourceAdapter("diavgeia") instanceof DiavgeiaSourceAdapter);
});

test("TedSourceAdapter parses Greek EU notices, cleans prefix, enforces minValueEur and builds summary", () => {
  const adapter = new TedSourceAdapter();
  const notices = [
    {
      ND: "757095-2026",
      PD: "2026-11-20+01:00",
      TI: { ell: "Ελλάδα – Υποσταθμοί – Κατασκευή νέου υποσταθμού υψηλής τάσης ΑΔΜΗΕ στην Κρήτη" },
      "buyer-name": { ell: ["ΑΔΜΗΕ Α.Ε."] },
      "estimated-value-proc": [12_500_000],
      "deadline-receipt-tender-date-lot": ["2026-12-18+02:00"],
      links: { html: { ELL: "https://ted.europa.eu/el/notice/-/detail/757095-2026" } },
    },
    {
      ND: "757096-2026",
      PD: "2026-11-20+01:00",
      TI: { ell: "Ελλάδα – Μικρή προμήθεια – Προμήθεια καλωδίων" },
      "estimated-value-proc": [120_000],
      links: { html: { ELL: "https://ted.europa.eu/el/notice/-/detail/757096-2026" } },
    },
  ];
  const items = adapter.parseNotices(notices, { minValueEur: 500_000, titleFilter: ["υποσταθμ*", "αδμηε"] });
  assert.equal(items.length, 1);
  assert.equal(items[0].url, "https://ted.europa.eu/el/notice/-/detail/757095-2026");
  assert.match(items[0].title, /^Διαγωνισμός: Κατασκευή νέου υποσταθμού/);
  assert.match(items[0].summary, /ΑΔΜΗΕ Α\.Ε\./);
  assert.match(items[0].summary, /€12\.5 εκατ\./);
  assert.match(items[0].summary, /Προθεσμία:/);
  assert.ok(hasTier1ActionWord(items[0].title));
});

test("DiavgeiaSourceAdapter humanizes ALL-CAPS subjects, enforces >=500k EUR and CPV/keyword gating", () => {
  assert.equal(
    humanizeDiavgeiaSubject("ΠΡΟΜΗΘΕΙΑ ΕΞΟΠΛΙΣΜΟΥ FTTH ΚΑΙ ΔΙΚΤΥΟΥ 5G ΓΙΑ ΤΟΝ ΟΤΕ"),
    "Προμηθεια εξοπλισμου FTTH και δικτυου 5G για τον ΟΤΕ",
  );
  const adapter = new DiavgeiaSourceAdapter();
  const decisions = [
    {
      ada: "Ψ1234567-ΑΒΓ",
      decisionTypeId: "Δ.2.1",
      issueDate: Date.parse("2026-11-22T09:00:00Z"),
      subject: "ΑΝΑΠΤΥΞΗ ΔΙΚΤΥΟΥ ΟΠΤΙΚΩΝ ΙΝΩΝ FTTH ΣΕ ΛΕΥΚΕΣ ΠΕΡΙΟΧΕΣ",
      extraFieldValues: {
        estimatedAmount: { amount: 2_400_000, currency: "EUR" },
        cpv: ["64200000-8"],
        adam: "26PROC001234",
      },
    },
    {
      ada: "Ψ9999999-ΧΨΩ",
      decisionTypeId: "Δ.2.1",
      issueDate: Date.parse("2026-11-22T09:00:00Z"),
      subject: "ΠΡΟΜΗΘΕΙΑ ΓΡΑΦΙΚΗΣ ΥΛΗΣ ΔΗΜΟΥ",
      extraFieldValues: {
        estimatedAmount: { amount: 45_000, currency: "EUR" },
        cpv: ["30192000-1"],
      },
    },
  ];
  const items = adapter.parseDecisions(decisions, {
    minAmountEur: 500_000,
    requireTitleFilter: true,
    titleFilter: ["οπτικ* ιν*", "ftth"],
  });
  assert.equal(items.length, 1);
  assert.equal(items[0].url, "https://diavgeia.gov.gr/decision/view/%CE%A81234567-%CE%91%CE%92%CE%93");
  assert.match(items[0].title, /^Διαγωνισμός: Αναπτυξη δικτυου οπτικων ινων FTTH/);
  assert.match(items[0].summary, /€2\.40? εκατ\./);
  assert.match(items[0].summary, /ΑΔΑΜ: 26PROC001234/);
  assert.ok(hasTier1ActionWord(items[0].title));
});

test("Tier-1 tender sources route primarily to tenders plus topical section", () => {
  const item = {
    sourceId: "ted-greek-tenders",
    tier: 1,
    url: "https://ted.europa.eu/el/notice/-/detail/1-2026",
    title: "Διαγωνισμός: Υποσταθμός υψηλής τάσης ΑΔΜΗΕ 15 εκατ. ευρώ",
    summary: "Διαγωνισμός ΕΕ (TED) · Φορέας: ΑΔΜΗΕ",
  };
  const forced = sourceForcedCategories(item);
  assert.equal(forced[0].category, "tenders");
  assert.ok(forced.some((m) => m.category === "energy"));
  assert.ok(!forced.some((m) => m.category === "regulators"));
});

test("Expanded watch rules and organizations detect Starlink, private 5G, FiberGrid, GSI/FSRU and BOAK", () => {
  const starlinkItem = {
    url: "https://example.test/starlink-fwa",
    title: "Starlink και 5G FWA: η νέα μάχη στην Ελλάδα με ιδιωτικό 5G και FiberGrid",
    summary: "Αύξηση συνδέσεων FWA και δορυφορικού internet στην ελληνική αγορά.",
    publishedAt: "2026-11-22T09:00:00Z",
  };
  const [rankedTelco] = rankItems([starlinkItem], DEFAULT_WATCH_RULES);
  assert.ok(rankedTelco?.relevance.some((m) => m.category === "telco"));
  const telcoOrgs = detectArticleOrganizations(starlinkItem).map((m) => m.organizationId);
  assert.ok(telcoOrgs.includes("starlink"));
  assert.ok(telcoOrgs.includes("ppc-fiber"));

  const energyItem = {
    url: "https://example.test/gsi-fsru",
    title: "Great Sea Interconnector και FSRU Αλεξανδρούπολης: επενδύσεις από Metlen και Motor Oil στην Ελλάδα",
    summary: "Νέες συμβάσεις PPA και έργα αποθήκευσης ενέργειας.",
    publishedAt: "2026-11-22T09:00:00Z",
  };
  const [rankedEnergy] = rankItems([energyItem], DEFAULT_WATCH_RULES);
  assert.ok(rankedEnergy?.relevance.some((m) => m.category === "energy"));
  const energyOrgs = detectArticleOrganizations(energyItem).map((m) => m.organizationId);
  assert.ok(energyOrgs.includes("metlen"));
  assert.ok(energyOrgs.includes("motor-oil"));

  const infraItem = {
    url: "https://example.test/boak-growthfund",
    title: "ΒΟΑΚ και Υπερταμείο: προχωρά η σύμβαση παραχώρησης με ΓΕΚ ΤΕΡΝΑ στην Ελλάδα",
    summary: "Νέο χρονοδιάγραμμα για τον Βόρειο Οδικό Άξονα Κρήτης.",
    publishedAt: "2026-11-22T09:00:00Z",
  };
  const [rankedInfra] = rankItems([infraItem], DEFAULT_WATCH_RULES);
  assert.ok(rankedInfra?.relevance.some((m) => m.category === "infrastructure"));
  const infraOrgs = detectArticleOrganizations(infraItem).map((m) => m.organizationId);
  assert.ok(infraOrgs.includes("growthfund"));
  assert.ok(infraOrgs.includes("gek-terna"));
});

test("Public articles expose sourceTier and trending entities cleanly without leaking internal fields", () => {
  const rows = [
    {
      canonical_url: "https://www.eett.gr/p1",
      title: "Απόφαση ΕΕΤΤ για το δίκτυο FTTH του ΟΤΕ στην Ελλάδα",
      summary: "Ρυθμιστική απόφαση για την αγορά οπτικών ινών.",
      published_at: "2026-11-23T09:00:00Z",
      source_id: "eett-press",
      metadata: {},
    },
    {
      canonical_url: "https://www.unitedfiber.gr/p2",
      title: "United Fiber: επέκταση FTTH σε συνεργασία με ΟΤΕ",
      summary: "Νέες συνδέσεις οπτικής ίνας.",
      published_at: "2026-11-23T08:00:00Z",
      source_id: "united-fiber",
      metadata: {},
    },
  ];
  const articles = selectArticles(rows);
  assert.equal(articles.length, 2);
  assert.equal(articles[0].sourceTier, "official");
  assert.equal(articles[1].sourceTier, "operator");
  const trending = extractTrendingEntities(articles);
  assert.equal(trending[0].name, "OTE Group / Cosmote");
  assert.equal(trending[0].count, 2);
});

test("config/sources.js registers the newly verified primary and sector sources", () => {
  const ids = new Set(SOURCES.filter((s) => s.enabled !== false).map((s) => s.id));
  for (const id of [
    "ted-greek-tenders",
    "diavgeia-tenders",
    "mindigital-announcements",
    "growthfund-announcements",
    "dapeep-announcements",
    "powergame-sector",
    "euro2day-business",
    "gnews-fibre",
  ]) {
    assert.ok(ids.has(id), `expected enabled source ${id}`);
  }
});

test("TED and Diavgeia tenders are sectionOnly: shown on /tenders, excluded from homepage news stream", () => {
  const now = Date.parse("2026-11-24T12:00:00Z");
  const rows = [
    {
      canonical_url: "https://diavgeia.gov.gr/decision/view/TEST1",
      title: "Διαγωνισμός: Υποσταθμός υψηλής τάσης 5 εκατ. ευρώ",
      summary: "Περίληψη διακήρυξης (Διαύγεια) · Ποσό: €5 εκατ.",
      published_at: "2026-11-24T09:00:00Z",
      source_id: "diavgeia-tenders",
      metadata: {},
    },
    {
      canonical_url: "https://www.ot.gr/ote-ftth-2026",
      title: "ΟΤΕ: νέο πρόγραμμα ανάπτυξης FTTH στην Ελλάδα",
      summary: "Επέκταση οπτικών ινών FTTH σε νέους δήμους.",
      published_at: "2026-11-24T08:00:00Z",
      source_id: "ot-gr",
      metadata: {},
    },
  ];
  const tendersPage = selectArticles(rows, { category: "tenders", now });
  assert.equal(tendersPage.length, 1);
  assert.equal(tendersPage[0].metadata.sectionOnly, true);

  const all = selectArticles(rows, { now });
  const home = buildHomepageSections(all, { now });
  assert.equal(home.lead?.url, "https://www.ot.gr/ote-ftth-2026");
  const homeUrls = [home.lead?.url, ...home.recent.map((a) => a.url), ...Object.values(home.columns).flat().map((a) => a.url)].filter(Boolean);
  assert.ok(!homeUrls.some((u) => u.includes("diavgeia.gov.gr")));
});
