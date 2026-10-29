import test from "node:test";
import assert from "node:assert/strict";
import {
  HOMEPAGE_FRESH_MIN_SCORE,
  noiseRejectReason,
  hasCultureCsrTerm,
  hasCultureExceptionSignal,
} from "../src/feed-rules.js";
import { buildHomepageSections, selectArticles } from "../src/public-data.js";
import { buildReviewDump } from "../scripts/review-dump.js";

const DAY = 24 * 3_600_000;
const iso = (now, days) => new Date(now - days * DAY).toISOString();
const dropsAsCulture = (title, sourceId = "any-source") => noiseRejectReason({ title, summary: "", sourceId })?.group === "culture_csr";
const shownOf = (r) => [r.lead, ...r.recent, ...Object.values(r.columns).flat()].filter(Boolean);

const PPC_ART = "Η ΔΕΗ Συναντά την Τέχνη Vol. 2: Άνοιξε στο κοινό η έκθεση με 55 έργα στον Ιστορικό ΑΗΣ Νέου Φαλήρου";

test("culture/CSR: the ΔΕΗ art-exhibition title is noise (culture_csr) from any source", () => {
  assert.ok(dropsAsCulture(PPC_ART, "ppc-press"));
  assert.ok(dropsAsCulture(PPC_ART, "energypress"));
});

test("culture/CSR: each new term drops (case/accent-insensitive, inflected)", () => {
  for (const title of [
    "Έκθεση φωτογραφίας στην Αθήνα", "ΕΚΘΕΣΗ ζωγραφικής", "Εγκαίνια εκθέσεων σύγχρονης τέχνης",
    "Νέα πρωτοβουλία για την Τέχνη", "Στήριξη της τέχνης και των τεχνών", "Συνεργασία με το Υπουργείο Πολιτισμού",
    "Νέος πολιτισμός στην πόλη", "Μεγάλος χορηγός της εκδήλωσης η εταιρεία", "Η εταιρεία ανακοίνωσε νέες χορηγίες",
    "Το φεστιβάλ κινηματογράφου ξεκινά", "Η εταιρεία βράβευσε εργαζομένους", "Βραβεύτηκαν μαθητές", "Εθελοντική δράση εργαζομένων", "Εθελοντές καθάρισαν την παραλία",
  ]) assert.ok(dropsAsCulture(title), title);
});

test("culture/CSR exception: a network/business keyword or a € figure in the title keeps the item", () => {
  assert.ok(!dropsAsCulture("Ο ΑΔΜΗΕ παρουσίασε το νέο δίκτυο στο πολιτιστικό κέντρο πολιτισμού"));
  // (round 6c: sponsorship words and a lone € figure no longer rescue; see the r6c tests)
  assert.ok(!dropsAsCulture("Έκθεση για την επένδυση σε υποσταθμούς"));
  assert.ok(hasCultureCsrTerm("Εθελοντές του ΑΔΜΗΕ") && hasCultureExceptionSignal("Εθελοντές του ΑΔΜΗΕ"));
});

test("culture/CSR: generic Greek words do not rescue a culture item (εργα = artworks, ιστορικός, δικτύωση)", () => {
  assert.equal(hasCultureExceptionSignal("Άνοιξε η έκθεση με 55 έργα στον Ιστορικό ΑΗΣ"), false);
  assert.equal(hasCultureExceptionSignal("Εθελοντική δικτύωση νέων"), false);
});

test("culture/CSR: 'έκθεση' meaning report is kept (ΡΑΑΕΥ/ΕΕΤΤ in title, report cues, έκθεση του <ACRONYM>)", () => {
  for (const title of [
    "Έκθεση της ΡΑΑΕΥ για την αγορά ενέργειας", "Έκθεση της ΕΕΤΤ για τις ευρυζωνικές συνδέσεις",
    "Ετήσια έκθεση της Τράπεζας της Ελλάδος", "Έκθεση αξιολόγησης του Ελεγκτικού Συνεδρίου",
    "Strand Consult: λάθη στην έκθεση του BEREC", "Έκθεση του ΟΟΣΑ για την Ελλάδα",
  ]) assert.ok(!dropsAsCulture(title), title);
});

test("culture/CSR: χορήγηση (granting a licence/loan) and τεχνητή (artificial) are not culture terms", () => {
  assert.ok(!dropsAsCulture("Χορήγηση άδειας παραγωγής σε φωτοβολταϊκό"));
  assert.ok(!dropsAsCulture("Τεχνητή νοημοσύνη στις εταιρείες"));
});

test("culture/CSR: the rule is title-only (a summary mention does not drop an item)", () => {
  assert.equal(noiseRejectReason({ title: "Νέο έργο στην Ελλάδα", summary: "Με χορηγία και έκθεση τέχνης", sourceId: "x" }), null);
});

test("culture/CSR: selectArticles drops it from every feed and onDrop reports noise/culture_csr", () => {
  const now = Date.now();
  const row = (url, title) => ({ url, canonical_url: url, title, summary: "", source_id: "energypress", published_at: iso(now, 0.2), score: 20, categories: ["energy"], relevance: [], metadata: {} });
  const drops = [];
  const out = selectArticles([row("https://a.test/art", PPC_ART), row("https://a.test/ok", "Διασύνδεση ΑΔΜΗΕ υποσταθμός νέα γραμμή")], { now, onDrop: (r, reason) => drops.push([r.url, reason]) });
  assert.ok(!out.some((a) => a.url === "https://a.test/art"));
  assert.ok(drops.some(([url, reason]) => url === "https://a.test/art" && reason.stage === "noise" && reason.group === "culture_csr"));
});

test("homepage: a fresh item under score 5 is dropped (below_fresh_floor); score 5 is kept", () => {
  const now = Date.now();
  assert.equal(HOMEPAGE_FRESH_MIN_SCORE, 5);
  const make = (suffix, score) => ({
    url: `https://a.test/${suffix}`, title: "Η Cosmote επεκτείνει το δίκτυο FTTH σε νέους δήμους", summary: "", sourceId: `src-${suffix}`,
    categories: ["telco"], score, publishedAt: iso(now, 0.1), metadata: {},
  });
  const drops = [];
  const result = buildHomepageSections([make("four", 4), make("five", 5)], { now, onDrop: (a, r) => drops.push([a.url, r.stage]) });
  assert.deepEqual(shownOf(result).map((a) => a.url), ["https://a.test/five"]);
  assert.deepEqual(drops, [["https://a.test/four", "below_fresh_floor"]]);
});

test("homepage: the fresh floor is homepage-only (selectArticles/section feeds still return the low-score item)", () => {
  const now = Date.now();
  const row = {
    url: "https://a.test/low", canonical_url: "https://a.test/low", title: "Η Cosmote επεκτείνει το δίκτυο FTTH σε νέους δήμους", summary: "",
    source_id: "fibernews", published_at: iso(now, 0.1), score: 0, categories: ["telco"], relevance: [], metadata: {},
  };
  assert.equal(selectArticles([row], { now, category: "telco" }).length, 1);
});

test("review dump: header reports homepageFreshMinScore and a fresh item under it lands in dropped, not on the homepage", () => {
  const NOW = new Date("2026-10-25T12:00:00Z").getTime();
  const report = {
    scannedAt: "2026-10-25T10:00:00.000Z", fetched: 1, relevant: 1, sources: [],
    items: [{ url: "https://a.test/x", title: "Η Cosmote επεκτείνει το δίκτυο FTTH σε νέους δήμους", summary: "", sourceId: "fibernews", publishedAt: iso(NOW, 0.1), score: 0, relevance: [], metadata: {} }],
  };
  const dump = buildReviewDump(report, { now: NOW });
  assert.equal(dump.header.rules.homepageFreshMinScore, 5);
  const shown = [dump.homepage.lead, ...dump.homepage.recent, ...Object.values(dump.homepage.columns).flat()].filter(Boolean);
  for (const a of shown) assert.ok(a.score >= 5 || a.homepageBackfill);
});

// ---- round 6c ----
test("r6c: sponsorship/award/volunteer-ικ words override the operator-name exception", () => {
  for (const title of [
    "Χορηγός του φεστιβάλ η Cosmote", "Η Vodafone ανακοίνωσε χορηγία για το δίκτυο νέων", "Νέοι χορηγοί από τη Nova",
    "Η Cosmote βράβευσε τους καλύτερους συνεργάτες δικτύου", "Βραβεύτηκε ο ΑΔΜΗΕ", "Βραβεύσεις της ΔΕΗ",
    "Εθελοντική δράση της Cosmote", "Εθελοντικές δράσεις του ΑΔΜΗΕ για το δίκτυο",
  ]) assert.ok(dropsAsCulture(title), title);
  assert.equal(hasCultureExceptionSignal("Χορηγός του φεστιβάλ η Cosmote"), false);
});

test("r6c: a € figure alone no longer saves a culture/CSR title", () => {
  assert.ok(dropsAsCulture("Φεστιβάλ με προϋπολογισμό €3 εκατ."));
  assert.ok(dropsAsCulture("Η εταιρεία ανακοίνωσε χορηγία €2 εκατ. για τον πολιτισμό"));
  assert.ok(dropsAsCulture("Έκθεση τέχνης με εισιτήριο 5 ευρώ"));
});

test("r6c: a € figure plus σύμβαση/επένδυση/εξαγορά/διαγωνισμός/δίκτυο (inflected) still saves it", () => {
  for (const title of [
    "Φεστιβάλ και σύμβαση €3 εκατ. για τον οργανισμό", "Πολιτισμός: επένδυση €10 εκατ. στην πόλη", "Φεστιβάλ μετά την εξαγορά €5 εκατ.",
    "Έκθεση τέχνης: διαγωνισμού αξίας €1 εκατ.", "Φεστιβάλ και δίκτυο €2 εκατ. στην περιφέρεια", "Φεστιβάλ και συμβάσεις €2 εκατ.",
  ]) assert.ok(!dropsAsCulture(title), title);
});

test("r6c: έκθεση-as-report protections are unchanged (BEREC item still kept)", () => {
  for (const title of [
    "Strand Consult: αριθμητικά λάθη στην έκθεση του BEREC", "Έκθεση της ΡΑΑΕΥ για την αγορά ενέργειας",
    "Ετήσια έκθεση της Τράπεζας της Ελλάδος", "Έκθεση του ΟΟΣΑ για την Ελλάδα", "Έκθεσης της ΡΑΑΕΥ για τις ΑΠΕ",
  ]) assert.ok(!dropsAsCulture(title), title);
  assert.ok(dropsAsCulture("Η ΔΕΗ Συναντά την Τέχνη Vol. 2: Άνοιξε στο κοινό η έκθεση με 55 έργα"));
});

test("r6c: έκθεσης (genitive singular) is matched like the other inflections", () => {
  assert.ok(dropsAsCulture("Εγκαίνια της έκθεσης φωτογραφίας"));
});
