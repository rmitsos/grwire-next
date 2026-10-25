import test from "node:test";
import assert from "node:assert/strict";
import {
  isDealsEligible,
  hasTier1ActionWord,
  isAgendaItem,
  agendaScoreCap,
  noiseRejectReason,
  NOISE_HARD_REJECT,
  DEFAULT_HOME_CAP_PER_SOURCE,
} from "../src/feed-rules.js";
import { selectArticles, buildHomepageSections } from "../src/public-data.js";
import { rankItems, DEFAULT_WATCH_RULES } from "../src/watch-rules.js";

function row({ url, title, summary = "", publishedAt, sourceId, metadata = {} }) {
  return {
    canonical_url: url, title, summary, published_at: publishedAt,
    source_id: sourceId, source_url: url, score: 0, categories: [], relevance: [], metadata,
  };
}

// --- (a) deals-companies gating ----------------------------------------------

test("isDealsEligible: no sector company mentioned -> false, even with 'αποτελέσματα' (the BEREC/ΕΕΤΤ case)", () => {
  assert.ok(!isDealsEligible({
    title: "Αποτελέσματα της 68ης Συνεδρίασης της Ολομέλειας του BEREC", summary: "",
  }));
});

test("isDealsEligible: company + 'αποτελέσματα' in the title -> true (ΟΤΕ results)", () => {
  assert.ok(isDealsEligible({ title: "ΟΤΕ: Αποτελέσματα εννεαμήνου", summary: "" }));
});

test("isDealsEligible: 'αποτελέσματα' with the company only in the summary, not the title -> false", () => {
  assert.ok(!isDealsEligible({
    title: "Αποτελέσματα εννεαμήνου για τον κλάδο",
    summary: "Η ΟΤΕ ανακοίνωσε αύξηση κερδοφορίας.",
  }));
});

test("isDealsEligible: company + a deal word (εξαγορά) -> true", () => {
  assert.ok(isDealsEligible({ title: "Εξαγορά startup οπτικών ινών από τη Vodafone", summary: "" }));
});

test("isDealsEligible: company mentioned with no deal word and no results language -> true (a sector company name is enough on its own)", () => {
  assert.ok(isDealsEligible({ title: "Η Vodafone επενδύει σε νέο data center", summary: "" }));
});

test("selectArticles: ΕΕΤΤ 'Αποτελέσματα ... Συνεδρίασης ... BEREC' ends in regulators, never deals", () => {
  const rows = [row({
    url: "https://eett.test/berec",
    title: "Αποτελέσματα της 68ης Συνεδρίασης της Ολομέλειας του BEREC",
    sourceId: "eett-press", publishedAt: new Date().toISOString(),
  })];
  const [article] = selectArticles(rows, {});
  assert.ok(article, "expected the item to survive selection");
  assert.ok(article.categories.includes("regulators"), `expected regulators, got ${article.categories}`);
  assert.ok(!article.categories.includes("deals"), `expected no deals category, got ${article.categories}`);
});

test("selectArticles: 'ΟΤΕ: Αποτελέσματα εννεαμήνου' stays in deals", () => {
  const rows = [row({
    url: "https://ote.test/results", title: "ΟΤΕ: Αποτελέσματα εννεαμήνου",
    sourceId: "ote-press-test", publishedAt: new Date().toISOString(),
  })];
  const [article] = selectArticles(rows, {});
  assert.ok(article, "expected the item to survive selection");
  assert.ok(article.categories.includes("deals"), `expected deals, got ${article.categories}`);
});

test("selectArticles: 'Εξαγορά ... από τη Vodafone' stays in deals", () => {
  const rows = [row({
    url: "https://news.test/vodafone-acquisition", title: "Εξαγορά startup οπτικών ινών από τη Vodafone",
    sourceId: "infocom-telecoms", publishedAt: new Date().toISOString(),
  })];
  const [article] = selectArticles(rows, {});
  assert.ok(article, "expected the item to survive selection");
  assert.ok(article.categories.includes("deals"), `expected deals, got ${article.categories}`);
});

test("selectArticles: deals is dropped entirely (deals_no_company) when it was the item's only category", () => {
  const rows = [row({
    url: "https://news.test/results", title: "Αποτελέσματα εννεαμήνου για τον κλάδο",
    summary: "Η ΟΤΕ ανακοίνωσε αύξηση κερδοφορίας.",
    sourceId: "infocom-telecoms", publishedAt: new Date().toISOString(),
  })];
  const dropped = [];
  const articles = selectArticles(rows, { onDrop: (_row, reason) => dropped.push(reason) });
  assert.equal(articles.length, 0);
  assert.ok(dropped.some((r) => r.stage === "deals_no_company"), `expected deals_no_company, got ${JSON.stringify(dropped)}`);
});

// --- (b)/(c) unchanged behaviour ---------------------------------------------

test("DEFAULT_HOME_CAP_PER_SOURCE is unchanged at 2", () => {
  assert.equal(DEFAULT_HOME_CAP_PER_SOURCE, 2);
});

test("NOISE_HARD_REJECT.market_wraps still drops dividend ('μέρισμα') mentions", () => {
  assert.ok(NOISE_HARD_REJECT.market_wraps.includes("μερισμα"));
  assert.ok(noiseRejectReason({ title: "Μέρισμα 0,40 ευρώ θα διανείμει η Vodafone" }));
});

// --- Tier-1 action-word rule --------------------------------------------------

test("hasTier1ActionWord matches διαβούλευση/απόφαση/φάσμα/πρόγραμμα ανάπτυξης, not a plain announcement", () => {
  assert.ok(hasTier1ActionWord("Δημόσια Διαβούλευση της ΡΑΑΕΥ επί του Προγράμματος Ανάπτυξης του ΔΕΔΔΗΕ"));
  assert.ok(hasTier1ActionWord("Το ΕΕΤΤ εξέδωσε απόφαση για το φάσμα συχνοτήτων"));
  assert.ok(!hasTier1ActionWord("Η ΕΕΤΤ αποχαιρετά τον Πρόεδρό της"));
});

test("rankItems: a tier-1 item with an action word in its title scores +10 over an identical item without one", () => {
  const base = {
    tier: 1, sourceId: "raaey-energy-announcements", url: "https://raaey.test/a",
    title: "Η ΡΑΑΕΥ ανακοίνωσε διοικητικές αλλαγές στο προσωπικό της", summary: "",
  };
  const withAction = {
    ...base, url: "https://raaey.test/b",
    title: "Η ΡΑΑΕΥ εξέδωσε απόφαση για διοικητικές αλλαγές στο προσωπικό της",
  };
  const [rankedBase] = rankItems([base], DEFAULT_WATCH_RULES);
  const [rankedAction] = rankItems([withAction], DEFAULT_WATCH_RULES);
  assert.equal(rankedBase.score, 3);
  assert.equal(rankedAction.score, 13, "expected the +10 action-word bonus on top of the base score");
});

test("buildHomepageSections: a non-action tier-1 item never appears on the homepage (tier1_no_action)", () => {
  const now = Date.now();
  const article = {
    url: "https://eett.test/farewell", title: "Η ΕΕΤΤ αποχαιρετά τον Πρόεδρό της", summary: "",
    sourceId: "eett-press", categories: ["regulators"], score: 10, publishedAt: new Date(now - 3_600_000).toISOString(), metadata: {},
  };
  const dropped = [];
  const result = buildHomepageSections([article], { now, onDrop: (_a, reason) => dropped.push(reason) });
  assert.equal(result.lead, null);
  assert.equal(result.recent.length, 0);
  assert.ok(dropped.some((r) => r.stage === "tier1_no_action"));
});

test("buildHomepageSections: an action-word tier-1 item is homepage-eligible", () => {
  const now = Date.now();
  const article = {
    url: "https://raaey.test/consultation",
    title: "Δημόσια Διαβούλευση της ΡΑΑΕΥ επί του Προγράμματος Ανάπτυξης του ΔΕΔΔΗΕ",
    summary: "", sourceId: "raaey-energy-announcements", categories: ["energy", "regulators"],
    score: 10, publishedAt: new Date(now - 3_600_000).toISOString(), metadata: {},
  };
  const result = buildHomepageSections([article], { now });
  const shown = [result.lead, ...result.recent, ...Object.values(result.columns).flat()].filter(Boolean);
  assert.ok(shown.some((a) => a.url === article.url), "expected the action-word ΡΑΑΕΥ item on the homepage");
});

test("selectArticles+buildHomepageSections: the ΡΑΑΕΥ ΔΕΔΔΗΕ/ΔΕΣΦΑ public-consultation titles are homepage-eligible", () => {
  const now = Date.now();
  const titles = [
    "Δημόσια Διαβούλευση της ΡΑΑΕΥ επί του Προγράμματος Ανάπτυξης του ΔΕΔΔΗΕ",
    "Δημόσια Διαβούλευση της ΡΑΑΕΥ επί της εισήγησης του Διαχειριστή ΔΕΣΦΑ",
  ];
  for (const title of titles) {
    const rows = [row({
      url: `https://raaey.test/${encodeURIComponent(title)}`, title,
      sourceId: "raaey-energy-announcements", publishedAt: new Date(now - 3_600_000).toISOString(),
    })];
    const articles = selectArticles(rows, {});
    const result = buildHomepageSections(articles, { now });
    const shown = [result.lead, ...result.recent, ...Object.values(result.columns).flat()].filter(Boolean);
    assert.ok(shown.length === 1, `expected "${title}" to be homepage-eligible`);
  }
});

// --- Agenda items --------------------------------------------------------------

test("isAgendaItem: ypen visit titles (name-first and place-first forms) are agenda items", () => {
  assert.ok(isAgendaItem(
    "Σταύρος Παπασταύρου σε Πάτμο και Λέρο: «Με έργα που δίνουν λύσεις, στηρίζουμε έμπρακτα τα νησιά μας»",
  ));
  assert.ok(isAgendaItem(
    "Στην Πάτμο και τη Λέρο ο Σταύρος Παπασταύρου – Έργα για το νερό, στήριξη στις υποδομές",
  ));
});

test("isAgendaItem: ΓΓΤΤ 'Συμμετοχή του ...' title is an agenda item", () => {
  assert.ok(isAgendaItem(
    "Συμμετοχή του Γενικού Γραμματέα Τηλεπικοινωνιών και Ταχυδρομείων, Κωνσταντίνου Καράντζαλου, στο συνέδριο της ITU",
  ));
});

test("isAgendaItem: a quote-only title, optionally prefixed by 'Name:', is an agenda item", () => {
  assert.ok(isAgendaItem("«Στηρίζουμε έμπρακτα τα νησιά μας»"));
  assert.ok(isAgendaItem("Σταύρος Παπασταύρου: «Στηρίζουμε έμπρακτα τα νησιά μας»"));
});

test("isAgendaItem: a regular decision/consultation title is not an agenda item", () => {
  assert.ok(!isAgendaItem("Δημόσια Διαβούλευση της ΡΑΑΕΥ επί του Προγράμματος Ανάπτυξης του ΔΕΔΔΗΕ"));
  assert.ok(!isAgendaItem("Η ΕΕΤΤ αποχαιρετά τον Πρόεδρό της"));
});

test("isAgendaItem: the action-word-phrase-at-start exception overrides an otherwise agenda-shaped title", () => {
  // "Δημόσια Διαβούλευση" (the formal name for a public consultation) at the
  // very start wins over the "συμμετοχή του" agenda term later in the title.
  const title = "Δημόσια Διαβούλευση για τη συμμετοχή του Γενικού Γραμματέα στο συνέδριο ενέργειας";
  assert.ok(!isAgendaItem(title), "the formal-act framing at the start must override the agenda shape");
});

test("agendaScoreCap clamps an agenda item's score to 39, leaves a non-agenda score untouched", () => {
  const agendaTitle = "Σταύρος Παπασταύρου σε Πάτμο και Λέρο: «...»";
  const nonAgendaTitle = "Δημόσια Διαβούλευση της ΡΑΑΕΥ επί του Προγράμματος Ανάπτυξης του ΔΕΔΔΗΕ";
  assert.equal(agendaScoreCap(80, agendaTitle), 39);
  assert.equal(agendaScoreCap(20, agendaTitle), 20);
  assert.equal(agendaScoreCap(80, nonAgendaTitle), 80);
});

test("buildHomepageSections: agenda items never appear on the homepage (agenda_item), regardless of tier", () => {
  const now = Date.now();
  const articles = [
    {
      url: "https://ypen.test/visit-1",
      title: "Σταύρος Παπασταύρου σε Πάτμο και Λέρο: «Με έργα που δίνουν λύσεις, στηρίζουμε έμπρακτα τα νησιά μας»",
      summary: "", sourceId: "ypen-energy-announcements", categories: ["infrastructure", "regulators"],
      score: 50, publishedAt: new Date(now - 3_600_000).toISOString(), metadata: {},
    },
    {
      url: "https://ypen.test/visit-2",
      title: "Στην Πάτμο και τη Λέρο ο Σταύρος Παπασταύρου – Έργα για το νερό, στήριξη στις υποδομές",
      summary: "", sourceId: "ypen-energy-announcements", categories: ["infrastructure", "regulators"],
      score: 50, publishedAt: new Date(now - 3_600_000).toISOString(), metadata: {},
    },
    {
      url: "https://ggtt.test/visit-3",
      title: "Συμμετοχή του Γενικού Γραμματέα Τηλεπικοινωνιών και Ταχυδρομείων, Κωνσταντίνου Καράντζαλου, στο συνέδριο της ITU",
      summary: "", sourceId: "ggtt-telecom-announcements", categories: ["telco", "regulators"],
      score: 50, publishedAt: new Date(now - 3_600_000).toISOString(), metadata: {},
    },
  ];
  const dropped = [];
  const result = buildHomepageSections(articles, { now, onDrop: (_a, reason) => dropped.push(reason) });
  const shown = [result.lead, ...result.recent, ...Object.values(result.columns).flat()].filter(Boolean);
  assert.equal(shown.length, 0, `expected no agenda items on the homepage, got ${shown.map((a) => a.url)}`);
  for (const article of articles) {
    assert.ok(dropped.some((r) => r.stage === "agenda_item"), `expected an agenda_item drop for ${article.url}`);
  }
});

test("selectArticles: an agenda item keeps its topical categories on section pages and gains regulators", () => {
  const rows = [row({
    url: "https://ypen.test/visit-1",
    title: "Σταύρος Παπασταύρου σε Πάτμο και Λέρο: «Με έργα που δίνουν λύσεις, στηρίζουμε έμπρακτα τα νησιά μας»",
    sourceId: "ypen-energy-announcements", publishedAt: new Date().toISOString(),
  })];
  const [article] = selectArticles(rows, {});
  assert.ok(article, "expected the agenda item to survive selection");
  assert.ok(article.categories.includes("regulators"), `expected regulators, got ${article.categories}`);
  assert.ok(article.categories.includes("infrastructure"), `expected infrastructure kept, got ${article.categories}`);
  assert.ok(article.score <= 39, `expected score capped at 39, got ${article.score}`);
});

test("buildHomepageSections: a non-action ΕΕΤΤ item is section-only (tier1_no_action), not homepage", () => {
  const now = Date.now();
  const rows = [row({
    url: "https://eett.test/farewell", title: "Η ΕΕΤΤ αποχαιρετά τον Πρόεδρό της",
    sourceId: "eett-press", publishedAt: new Date(now - 3_600_000).toISOString(),
  })];
  const articles = selectArticles(rows, {});
  assert.equal(articles.length, 1, "expected the item to still exist on its section page");
  const dropped = [];
  const result = buildHomepageSections(articles, { now, onDrop: (_a, reason) => dropped.push(reason) });
  const shown = [result.lead, ...result.recent, ...Object.values(result.columns).flat()].filter(Boolean);
  assert.equal(shown.length, 0);
  assert.ok(dropped.some((r) => r.stage === "tier1_no_action"));
});

// --- Out-of-scope noise drops --------------------------------------------------

test("noiseRejectReason: consumer fuel/heating price drops (πετρέλαιο θέρμανσης)", () => {
  const reason = noiseRejectReason({ title: "Μείωση 40 λεπτά στο πετρέλαιο θέρμανσης, 20 λεπτά στο πετρέλαιο κίνησης" });
  assert.ok(reason);
  assert.equal(reason.group, "consumer_fuel");
});

test("noiseRejectReason: heating subsidy (επίδομα) and fuel-price roundups are consumer_fuel", () => {
  assert.equal(noiseRejectReason({ title: "Ανακοινώθηκε νέο επίδομα θέρμανσης για ευάλωτα νοικοκυριά" })?.group, "consumer_fuel");
  assert.equal(noiseRejectReason({ title: "Οι τιμές καυσίμων ανέβηκαν αυτή την εβδομάδα" })?.group, "consumer_fuel");
});

test("noiseRejectReason: marine-park/environment-only drops (no grid/works angle)", () => {
  const reason = noiseRejectReason({ title: "Η Ελλάδα προχωρά στην προστασία των θαλασσών της – στο ΣτΕ τα θαλάσσια πάρκα" });
  assert.ok(reason);
  assert.equal(reason.group, "environment_only");
});

test("noiseRejectReason: a marine-park item with a grid/works angle is kept", () => {
  const reason = noiseRejectReason({
    title: "Η ΑΔΜΗΕ υπογράφει συμφωνία για υποθαλάσσιο καλώδιο εντός θαλάσσιου πάρκου",
  });
  assert.equal(reason, null);
});
