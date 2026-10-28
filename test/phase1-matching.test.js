import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { DEFAULT_WATCH_RULES, rankItems, scoreItem } from "../src/index.js";

// Fixtures are copied verbatim from a live `node scripts/scan.js` run on
// 2026-10-25, see test/phase1-regressions.test.js.
const fixturePath = fileURLToPath(new URL("./fixtures/scan-2026-10-25.json", import.meta.url));
const { items: FIXTURE_ITEMS } = JSON.parse(readFileSync(fixturePath, "utf8"));
function byTitle(title) {
  const item = FIXTURE_ITEMS.find((candidate) => candidate.title === title);
  if (!item) throw new Error(`Fixture item not found: ${title}`);
  return item;
}

const RENTAL_TITLE = "Τι κατοικίες προτιμούν οι ενοικιαστές στην Ελλάδα το 2026";
const HOTEL_TITLE = "“Πράσινο φως” με αλλαγές για το νέο 5άστερο ξενοδοχείο στη Σόλωνος";
const GR_IT_TENDERS_TITLE = "Το 2027 οι διαγωνισμοί για την δεύτερη ηλεκτρική διασύνδεση Ελλάδας – Ιταλίας";
const GR_IT_SEABED_TITLE = "Τον Ιανουάριο η έρευνα βυθού για την ηλεκτρική διασύνδεση Ελλάδας – Ιταλίας";

const telcoRule = DEFAULT_WATCH_RULES.find((rule) => rule.id === "greek-telco-infrastructure");
const infraRule = DEFAULT_WATCH_RULES.find((rule) => rule.id === "greek-infrastructure");

function categoriesFor(item) {
  const [ranked] = rankItems([item], DEFAULT_WATCH_RULES);
  return ranked?.relevance.map((match) => match.category) || [];
}

// --- 1. GLOBAL_EXCLUSIONS no longer rejects FTTH/fibre "κατοικίες" coverage ---

test("FTTH rollout reaching hundreds of thousands of κατοικίες is accepted as telco", () => {
  const item = {
    url: "https://example.test/dei-fiber-ftth-katoikies",
    title: "Η ΔΕΗ Fiber έφτασε τις 500.000 κατοικίες με FTTH",
    summary: "Η ΔΕΗ Fiber ανακοίνωσε ότι το δίκτυο FTTH της έφτασε τις 500.000 κατοικίες σε όλη την Ελλάδα.",
    publishedAt: "2026-10-24T09:00:00.000Z",
  };
  assert.ok(categoriesFor(item).includes("telco"), `expected a telco match, got ${categoriesFor(item)}`);
});

test("fibre-to-the-home coverage of 1.5m κατοικίες is accepted as telco", () => {
  const item = {
    url: "https://example.test/optiki-ina-katoikies",
    title: "Οπτική ίνα σε 1,5 εκατ. κατοικίες: η πρόοδος του δικτύου FTTH στην Ελλάδα",
    summary: "Η επέκταση της οπτικής ίνας έφτασε 1,5 εκατομμύριο κατοικίες στην Ελλάδα, σύμφωνα με στοιχεία της αγοράς τηλεπικοινωνιών.",
    publishedAt: "2026-10-24T09:00:00.000Z",
  };
  assert.ok(categoriesFor(item).includes("telco"), `expected a telco match, got ${categoriesFor(item)}`);
});

test("rental housing story is still rejected by every watch rule", () => {
  const ranked = rankItems([byTitle(RENTAL_TITLE)], DEFAULT_WATCH_RULES);
  assert.equal(ranked.length, 0);
});

test("5-star hotel lifestyle story is still rejected by every watch rule", () => {
  const ranked = rankItems([byTitle(HOTEL_TITLE)], DEFAULT_WATCH_RULES);
  assert.equal(ranked.length, 0);
});

// --- 2. Word-start aware matching -----------------------------------------

test("\"annual report\" and \"sports\" copy does not trigger the infrastructure 'port' strong topic", () => {
  const item = {
    url: "https://example.test/aktor-sports-report",
    title: "AKTOR Sports Management δημοσίευσε το ετήσιο report για το 2026",
    summary: "Η εταιρεία παρουσίασε αυξημένα κέρδη στο annual report της, με νέα sponsorships στον αθλητισμό.",
    publishedAt: "2026-10-24T09:00:00.000Z",
  };
  const categories = categoriesFor(item);
  assert.ok(!categories.includes("infrastructure"), `expected no infrastructure match, got ${categories}`);
});

test("\"ποτέ\"/\"όποτε\" do not match the ΟΤΕ entity", () => {
  const item = {
    url: "https://example.test/pote-tetoies-praktikes",
    title: "Ο Πρωθυπουργός δήλωσε ότι δεν θα δεχθεί ποτέ τέτοιες πρακτικές, όποτε και αν προκύψουν",
    summary: "Δήλωση για πρακτικές που δεν θα γίνουν ανεκτές.",
    publishedAt: "2026-10-24T09:00:00.000Z",
  };
  const { reasons } = scoreItem(item, telcoRule);
  assert.ok(
    !reasons.some((reason) => reason.startsWith("monitored entity")),
    `expected no entity match, got reasons ${reasons}`,
  );
});

test("\"innovation\" does not match the Nova entity", () => {
  const item = {
    url: "https://example.test/kainotomia-innovation",
    title: "Η καινοτομία (innovation) στον κλάδο της τεχνολογίας αυξάνεται",
    summary: "Έρευνα δείχνει αύξηση της καινοτομίας στην ελληνική τεχνολογική βιομηχανία.",
    publishedAt: "2026-10-24T09:00:00.000Z",
  };
  const { reasons } = scoreItem(item, telcoRule);
  assert.ok(
    !reasons.some((reason) => reason.startsWith("monitored entity")),
    `expected no entity match, got reasons ${reasons}`,
  );
});

test("\"τηλεπικοινωνίες\" still matches the τηλεπικοινων stem", () => {
  const item = {
    url: "https://example.test/tilepikoinonies-esoda",
    title: "Οι τηλεπικοινωνίες στην Ελλάδα αυξάνουν τα έσοδά τους",
    summary: "Οι εταιρείες τηλεπικοινωνιών ανακοίνωσαν αύξηση εσόδων.",
    publishedAt: "2026-10-24T09:00:00.000Z",
  };
  const { reasons } = scoreItem(item, telcoRule);
  assert.ok(
    reasons.some((reason) => reason.startsWith("watched topic")),
    `expected a topic match, got reasons ${reasons}`,
  );
});

// --- 3. Electricity-context exclusions only apply with no telecom signal --

test("Grid Telecom's fibre subsea cable (over ex-ΑΔΜΗΕ infrastructure) is accepted as telco", () => {
  const item = {
    url: "https://example.test/grid-telecom-fibre-subsea-cable",
    title: "Η Grid Telecom, θυγατρική του ΑΔΜΗΕ, ανακοίνωσε νέο υποθαλάσσιο καλώδιο",
    summary: "Το καλώδιο της Grid Telecom μεταφέρει οπτικές ίνες (fibre) ανάμεσα σε νησιά.",
    publishedAt: "2026-10-24T09:00:00.000Z",
  };
  assert.ok(categoriesFor(item).includes("telco"), `expected a telco match, got ${categoriesFor(item)}`);
});

test("ΔΕΗ Fiber riding the ΔΕΔΔΗΕ network for FTTH is accepted as telco", () => {
  const item = {
    url: "https://example.test/dei-fiber-over-deddie-network",
    title: "Η ΔΕΗ Fiber επεκτείνει δίκτυο FTTH πάνω από το δίκτυο του ΔΕΔΔΗΕ",
    summary: "Η ΔΕΗ Fiber χρησιμοποιεί την υποδομή του ΔΕΔΔΗΕ για να φέρει οπτικές ίνες FTTH σε νέες περιοχές της Ελλάδας.",
    publishedAt: "2026-10-24T09:00:00.000Z",
  };
  assert.ok(categoriesFor(item).includes("telco"), `expected a telco match, got ${categoriesFor(item)}`);
});

test("Greece-Italy electrical interconnection stories are still energy, not telecom", () => {
  for (const title of [GR_IT_TENDERS_TITLE, GR_IT_SEABED_TITLE]) {
    const categories = categoriesFor(byTitle(title));
    assert.ok(!categories.includes("telco"), `"${title}" should not be telco, got ${categories}`);
    assert.ok(categories.includes("energy"), `"${title}" should be energy, got ${categories}`);
  }
});

test("infrastructure rule stays unaffected: AKTOR concession story is still infrastructure", () => {
  const item = {
    url: "https://example.test/aktor-concession-smoke-test",
    title: "AKTOR: Υπεγράφη σύμβαση παραχώρησης για νέο αυτοκινητόδρομο στην Ελλάδα",
    summary: "Η AKTOR υπέγραψε σύμβαση παραχώρησης για την κατασκευή νέου αυτοκινητόδρομου στην Ελλάδα.",
    publishedAt: "2026-10-24T09:00:00.000Z",
  };
  assert.ok(categoriesFor(item).includes("infrastructure"));
  assert.ok(infraRule, "expected the greek-infrastructure rule to exist");
});
