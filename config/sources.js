/**
 * Initial source registry. Disabled entries are documented targets whose
 * exact endpoint must be verified before production use.
 */
export const SOURCES = [
  {
    id: "gdelt-greek-telco",
    type: "gdelt",
    enabled: false,
    url: "https://api.gdeltproject.org/api/v2/doc/doc",
    query: '(OTE OR Cosmote OR Vodafone OR Nova OR "PPC Fiber" OR "United Fiber" OR EETT) (FTTH OR fiber OR fibre OR 5G OR broadband OR spectrum OR network)',
    timespan: "7days",
    limit: 125,
  },
  {
    id: "gdelt-greek-energy",
    type: "gdelt",
    enabled: false,
    url: "https://api.gdeltproject.org/api/v2/doc/doc",
    query: '(ADMIE OR IPTO OR HEDNO OR DESFA OR RAAEY OR PPC OR DEPA) (grid OR substation OR interconnection OR storage OR renewable OR electricity OR gas)',
    timespan: "7days",
    limit: 125,
  },
  {
    id: "gdelt-greek-finance",
    type: "gdelt",
    enabled: false,
    url: "https://api.gdeltproject.org/api/v2/doc/doc",
    query: '("Alpha Bank" OR Eurobank OR "National Bank of Greece" OR "Piraeus Bank" OR ATHEX OR "Athens Stock Exchange") (results OR earnings OR dividend OR acquisition OR bond OR loan OR capital)',
    timespan: "7days",
    limit: 125,
  },
  {
    id: "gdelt-greek-infrastructure",
    type: "gdelt",
    enabled: false,
    url: "https://api.gdeltproject.org/api/v2/doc/doc",
    query: '(Greece OR Greek) (infrastructure OR construction OR concession OR railway OR motorway OR "data center" OR subsea cable)',
    timespan: "7days",
    limit: 125,
  },
  {
    // Redundant: superseded by the "ot-gr" WordPress source below, which
    // targets the Business/Ενέργεια/Τηλεπικοινωνίες/Κατασκευές categories
    // directly instead of pulling the whole site.
    id: "ot-wordpress",
    type: "wordpress",
    enabled: false,
    url: "https://www.ot.gr",
    lookbackDays: 7,
    limit: 100,
  },
  {
    // The HTML listing page loads its list via admin-ajax (search-filter
    // plugin), so the HTML adapter only ever saw 2 nav links. The site-wide
    // /feed/ only contains two 2022 "Τεστ" posts (sources-spec.md §8: do not
    // use); the WP REST API needs auth (401/403). This post-type feed is the
    // working public feed (verified 25 Oct 2026, latest item 20 Oct 2026).
    // Low volume (a few per month).
    // Renamed from "eett-announcements" to "eett-press" per sources-spec.md
    // §2.1 (same feed URL, id: replaces eett-announcements). Rows ingested
    // before this change carry source_id "eett-announcements" in the DB.
    id: "eett-press",
    name: "ΕΕΤΤ – Δελτία Τύπου",
    type: "rss",
    tier: 1,
    url: "https://www.eett.gr/feed/?post_type=deltia_tipou",
    excludeTitlePatterns: ["^Τεστ"],
    sections: ["regulators-policy", "telecom-fibre"],
    weight: 1.0,
    dayCap: 8,
    homeCap: 2,
    pollMin: 60,
    limit: 100,
  },
  {
    id: "infocom-telecoms",
    name: "InfoCom – Telecoms",
    type: "rss",
    tier: 4,
    url: "https://infocom.gr/telecoms/feed/",
    sections: ["telecom-fibre", "deals-companies"],
    weight: 0.8,
    dayCap: 8,
    homeCap: 2,
    pollMin: 60,
  },
  {
    id: "fibernews",
    name: "Fibernews",
    type: "rss",
    tier: 4,
    url: "https://fibernews.gr/feed/",
    sections: ["telecom-fibre"],
    weight: 0.8,
    dayCap: 6,
    homeCap: 2,
    pollMin: 60,
  },
  {
    id: "united-fiber",
    name: "United Fiber",
    type: "rss",
    tier: 3,
    url: "https://www.unitedfiber.gr/feed/",
    sections: ["telecom-fibre"],
    weight: 0.9,
    dayCap: 4,
    homeCap: 1,
    pollMin: 1440,
  },
  {
    // sources-spec.md §2.2 ppc-press: all 12 Latin month slugs, confirmed
    // against the site's month menu.
    id: "ppc-press",
    name: "ΔΕΗ – Δελτία Τύπου (μηνιαία σελίδα)",
    type: "html-scrape",
    tier: 3,
    urlTemplate: "https://www.ppcgroup.com/el/omilos-dei/grafeio-typou/deltia-typou/prosfata/deltia-tipou-{yyyy}/{month_el_latin}-{yyyy}/",
    monthElLatin: {
      1: "ianouarios", 2: "fevrouarios", 3: "martios", 4: "aprilios",
      5: "maios", 6: "iounios", 7: "ioulios", 8: "avgoustos",
      9: "septemvrios", 10: "oktovrios", 11: "noemvrios", 12: "dekemvrios",
    },
    sections: ["energy-grids", "telecom-fibre", "deals-companies"],
    weight: 0.9,
    dayCap: 4,
    homeCap: 1,
    pollMin: 180,
    prefilter: true,
    linkPattern: "/deltia-tipou-\\d{4}/[a-z]+-\\d{4}/[a-z0-9-]+/$",
    dateRegex: "(\\d{2})\\.(\\d{2})\\.(20\\d\\d)",
  },
  {
    // The HTML page https://www.raaey.gr/energeia/anakinoseis/ returns HTTP
    // 500; WP REST works (200). Categories per sources-spec.md §2.1 (verified
    // 25 Oct 2026): 17 δελτία τύπου, 110 ανακοινώσεις, 109 διαβουλεύσεις,
    // 108 αποφάσεις ηλεκτρισμού, 111 αποφάσεις φυσικού αερίου. 16/28/112/122
    // are excluded per spec (thousands of boilerplate licensing decisions,
    // e.g. "ΑΠΟΦΑΣΗ ΑΝΤΙΠΡΟΕΔΡΟΥ ... ΥΠ' ΑΡΙΘΜ.").
    id: "raaey-energy-announcements",
    name: "ΡΑΑΕΥ",
    type: "wordpress",
    tier: 1,
    url: "https://www.raaey.gr/energeia",
    categories: [17, 110, 109, 108, 111],
    lookbackDays: 21,
    limit: 30,
  },
  {
    // round-4: ypen.gov.gr is WordPress; WP REST works (the old html source
    // only ever scraped navigation links — no press releases, no dates).
    // Category 7 = "Ανακοινώσεις Τύπου" (anakoinoseis-typou). ΥΠΕΝ also
    // covers environment/urban planning/forestry, so titleFilter keeps only
    // energy-relevant posts (see WordPressSourceAdapter).
    id: "ypen-energy-announcements",
    name: "ΥΠΕΝ – Ανακοινώσεις Τύπου",
    type: "wordpress",
    tier: 1,
    url: "https://ypen.gov.gr",
    categories: [7],
    lookbackDays: 21,
    titleFilter: [
      "ενεργει*", "ηλεκτρ*", "απε", "φωτοβολταικ*", "αιολικ*", "αποθηκευσ*",
      "δικτυ*", "φυσικ* αερι*", "υδρογον*", "διασυνδεσ*", "ραα*υ", "αδμηε",
      "δεδδηε", "δεσφα", "εξοικονομ*",
    ],
    limit: 30,
  },
  {
    // round-4: restricted to /posts/<slug> article links only (the old html
    // listing source also picked up /section/ nav links and bare /posts).
    // The GgttSourceAdapter also parses the Greek date ("20 Οκτωβρίου 2026")
    // and an optional "Η προθεσμία έληξε" prefix out of the listing title.
    id: "ggtt-telecom-announcements",
    name: "ΓΓΤΤ – Τηλεπικοινωνίες",
    type: "ggtt",
    tier: 1,
    url: "https://ggtt.mindigital.gr/section/telecom",
    limit: 100,
  },
  {
    // 0 accepted of 35 fetched in the 25 Oct 2026 live scan (titles only, no
    // summary, rarely reach the relevance threshold). Covered by the "ot-gr"
    // WordPress source's category 294 (Τηλεπικοινωνίες), which has excerpts.
    id: "ot-telecoms",
    type: "html",
    tier: 4,
    enabled: false,
    url: "https://www.ot.gr/category/epixeiriseis/tilepikoinonies/",
    linkPatterns: ["tilepikoin", "ote", "cosmote", "vodafone", "nova", "ftth", "fiber", "fibre", "5g", "network", "telekom"],
    minimumTitleLength: 16,
    timeoutMs: 20000,
    limit: 100,
  },
  {
    id: "netweek-telecoms",
    type: "html",
    tier: 4,
    url: "https://netweek.gr/category/telecoms/",
    linkPatterns: ["telecom", "ote", "cosmote", "vodafone", "nova", "ftth", "fiber", "fibre", "5g", "ufbb", "network", "connectivity", "τηλεπικ"],
    minimumTitleLength: 16,
    limit: 120,
  },
  {
    id: "naftemporiki-telecoms",
    type: "html",
    tier: 4,
    requirePublishedAt: true, // go-live: the tag page lists months-old undated links; only dated items are ingested
    url: "https://www.naftemporiki.gr/tag/tilepikoinonies/",
    linkPatterns: ["tilepikoin", "telecom", "ote", "cosmote", "vodafone", "nova", "ftth", "fiber", "fibre", "5g", "network", "internet", "δικτυ", "κινητ"],
    minimumTitleLength: 16,
    limit: 120,
  },
  {
    // Disabled per sources-spec.md §8 (verified 25 Oct 2026): the tag page
    // loads but has no article links in the static HTML, and the tag feed
    // (https://www.dnews.gr/site/tag/ΕΕΤΤ/feed) returns the HTML page, not
    // RSS. The ΕΕΤΤ feed above (eett-press) covers the same ground.
    id: "dnews-eett",
    type: "html",
    tier: 4,
    enabled: false,
    url: "https://www.dnews.gr/site/tag/%CE%95%CE%95%CE%A4%CE%A4",
    linkPatterns: ["eett", "%CE%95%CE%95%CE%A4%CE%A4", "eidhseis", "tilepikoin", "telecom", "mobile", "χρεω"],
    minimumTitleLength: 16,
    limit: 100,
  },
  {
    // Disabled per sources-spec.md §8 (verified 25 Oct 2026): the press URL
    // redirects to /404.html.
    id: "intracom-telecom-press",
    type: "html",
    tier: 3,
    enabled: false,
    url: "https://www.intracom-telecom.com/en/news/press.htm",
    linkPatterns: ["/en/news/press/"],
    minimumTitleLength: 16,
    limit: 100,
  },
  {
    // Re-enabled per sources-spec.md §2.3 (verified 25 Oct 2026): /feed
    // returns 404, but /rss returns 200 with 100 items (the previous
    // wp-json "energypress-wordpress" source stays disabled below in
    // favour of this feed).
    id: "energypress",
    type: "rss",
    tier: 4,
    url: "https://energypress.gr/rss",
  },
  {
    id: "energypress-wordpress",
    type: "wordpress",
    tier: 4,
    enabled: false,
    url: "https://energypress.gr",
    lookbackDays: 7,
    limit: 100,
  },
  {
    id: "ypodomes-wordpress",
    type: "wordpress",
    tier: 4,
    url: "https://ypodomes.com",
    lookbackDays: 7,
    limit: 100,
  },
  {
    id: "insider-wordpress",
    type: "wordpress",
    tier: 4,
    enabled: false,
    url: "https://www.insider.gr",
    lookbackDays: 7,
    limit: 100,
  },
  {
    id: "naftemporiki",
    type: "rss",
    tier: 4,
    url: "https://www.naftemporiki.gr/feed/",
  },
  {
    // The general /feed/ is dominated by world/politics/lifestyle (1 of 35
    // relevant in the 25 Oct 2026 scan); WP REST answers 200 with excerpts.
    // Deliberate divergence from sources-spec.md §2.3, which suggests the
    // main https://www.ot.gr/feed/ RSS with a prefilter: that feed was
    // re-verified 25 Oct 2026 with the same world/politics noise this
    // WP REST category query (verified 200, with excerpts) already avoids.
    id: "ot-gr",
    type: "wordpress",
    tier: 4,
    url: "https://www.ot.gr",
    categories: [7, 21, 294, 295],
    lookbackDays: 7,
    // ot.gr's nginx/WAF returns 403 on WP REST requests with per_page >= 40;
    // per_page 30 is verified 200. Keep limit <= 30.
    limit: 30,
  },
  {
    // Disabled per sources-spec.md §8 (verified 25 Oct 2026): this query
    // returns TV listings (e.g. "Πρόγραμμα καναλιών"), not telecom news.
    // To be replaced by a narrower FTTH query later (see spec §2.3
    // gnews-fibre).
    id: "google-news-greek-telco",
    type: "rss",
    tier: 4,
    enabled: false,
    url: "https://news.google.com/rss/search?q=%28OTE%20OR%20Cosmote%20OR%20Vodafone%20OR%20Nova%20OR%20Intracom%20OR%20FTTH%20OR%205G%20OR%20telecom%20OR%20%CF%84%CE%B7%CE%BB%CE%B5%CF%80%CE%B9%CE%BA%CE%BF%CE%B9%CE%BD%CF%89%CE%BD%CE%AF%CE%B5%CF%82%20OR%20%CE%95%CE%95%CE%A4%CE%A4%29%20Greece&hl=el&gl=GR&ceid=GR%3Ael",
    limit: 60,
  },
  {
    id: "google-news-greek-energy",
    type: "rss",
    tier: 4,
    url: "https://news.google.com/rss/search?q=%28ADMIE%20OR%20IPTO%20OR%20HEDNO%20OR%20DEDDIE%20OR%20RAAEY%20OR%20PPC%20OR%20renewable%20OR%20storage%29%20Greece&hl=el&gl=GR&ceid=GR%3Ael",
    limit: 60,
  },
  {
    // Verified 2026-11-24: EU TED v3 API (200 OK JSON) for active Greek public
    // procurement notices across telecom, energy-grid and civil-infrastructure CPVs.
    id: "ted-greek-tenders",
    name: "TED – Δημόσιοι Διαγωνισμοί ΕΕ",
    type: "ted",
    tier: 1,
    url: "https://api.ted.europa.eu/v3/notices/search",
    country: "GRC",
    lookbackDays: 21,
    minValueEur: 500_000,
    titleFilter: [
      "οπτικ* ιν*", "ftth", "5g", "τηλεπικοινων*", "ευρυζων*", "data center*", "κεντρ* δεδομενων",
      "υποσταθμ*", "διασυνδεσ*", "ηλεκτρικ*", "ηλεκτροπαραγ*", "ενεργει*", "απε", "φωτοβολταικ*", "αιολικ*", "αποθηκευσ*", "μπαταρι*",
      "φυσικ* αερι*", "αγωγ*", "σιδηροδρομ*", "μετρο", "αυτοκινητοδρομ*", "σηραγγ*", "γεφυρ*", "λιμαν*", "αεροδρομ*",
      "αδμηε", "δεδδηε", "δεσφα", "οσε", "δεη", "οτε", "σδιτ", "παραχωρησ*",
    ],
    sections: ["tenders-contracts"],
    weight: 1.0,
    dayCap: 6,
    homeCap: 2,
    pollMin: 180,
    limit: 40,
  },
  {
    // Verified 2026-11-24: Greek Government Diavgeia OpenData API (200 OK JSON)
    // for Δ.2.1 (Tender Summary) and Δ.2.2 (Contract Award) >= €500k in our sectors.
    id: "diavgeia-tenders",
    name: "Διαύγεια – Διαγωνισμοί & Αναθέσεις",
    type: "diavgeia",
    tier: 1,
    url: "https://diavgeia.gov.gr/luminapi/opendata/search.json",
    decisionTypes: ["Δ.2.1", "Δ.2.2"],
    lookbackDays: 14,
    minAmountEur: 500_000,
    requireTitleFilter: true,
    titleFilter: [
      "οπτικ* ιν*", "ftth", "5g", "τηλεπικοινων*", "ευρυζων*", "data center*", "κεντρ* δεδομενων",
      "υποσταθμ*", "διασυνδεσ*", "ηλεκτρικ*", "ηλεκτροπαραγ*", "απε", "φωτοβολταικ*", "αιολικ*", "αποθηκευσ*", "μπαταρι*",
      "φυσικ* αερι*", "αγωγ*", "σιδηροδρομ*", "μετρο", "αυτοκινητοδρομ*", "σηραγγ*", "γεφυρ*", "λιμαν*", "αεροδρομ*",
      "αδμηε", "δεδδηε", "δεσφα", "οσε", "σδιτ", "παραχωρησ*", "βοακ",
    ],
    sections: ["tenders-contracts"],
    weight: 1.0,
    dayCap: 6,
    homeCap: 2,
    pollMin: 180,
    limit: 30,
  },
  {
    // Verified 2026-11-24: Ministry of Digital Governance WP REST API (200 OK).
    // Categories: 24 = Δελτία Τύπου - Ανακοινώσεις, 31 = Δημόσια Διαβούλευση.
    id: "mindigital-announcements",
    name: "Υπ. Ψηφιακής Διακυβέρνησης",
    type: "wordpress",
    tier: 1,
    url: "https://www.mindigital.gr",
    categories: [24, 31],
    lookbackDays: 21,
    titleFilter: [
      "τηλεπικοινων*", "οπτικ* ιν*", "ftth", "5g", "ευρυζων*", "gigabit", "ufbb", "smart readiness",
      "φασμα*", "δορυφορ*", "μικροδορυφορ*", "data center*", "κεντρ* δεδομενων", "ai factory", "pharos",
      "υποθαλασσι*", "δικτυ*", "εεττ", "διαγωνισμ*", "διαβουλευσ*", "κυβερνοασφαλ*",
    ],
    sections: ["regulators-policy", "telecom-fibre"],
    weight: 1.0,
    dayCap: 6,
    homeCap: 2,
    limit: 30,
  },
  {
    // Verified 2026-11-24: Growthfund / Υπερταμείο WP REST API (200 OK).
    // Filtered to concessions, ports, airports, infrastructure, energy & telecom tenders.
    id: "growthfund-announcements",
    name: "Υπερταμείο – Growthfund",
    type: "wordpress",
    tier: 1,
    url: "https://growthfund.gr",
    lookbackDays: 21,
    titleFilter: [
      "διαγωνισμ*", "προτιμητε* επενδυτ*", "παραχωρησ*", "λιμαν*", "αεροδρομ*", "υποδομ*",
      "ενεργει*", "δικτυ*", "τηλεπικοινων*", "σδιτ", "σιδηροδρομ*", "μεταφορ*", "μαριν*", "συμβασ*",
    ],
    sections: ["tenders-contracts", "infrastructure-works"],
    weight: 0.95,
    dayCap: 4,
    homeCap: 1,
    limit: 25,
  },
  {
    // Verified 2026-11-24: DAPEEP (RES & Guarantees of Origin Operator) WP REST API (200 OK).
    // Excludes all-ASCII English duplicate posts so Greek announcements appear once.
    id: "dapeep-announcements",
    name: "ΔΑΠΕΕΠ",
    type: "wordpress",
    tier: 3,
    url: "https://www.dapeep.gr",
    excludeTitlePatterns: ["^[A-Za-z0-9\\s\\-:.,()'/&]+$"],
    lookbackDays: 21,
    sections: ["energy-grids"],
    weight: 0.9,
    dayCap: 4,
    homeCap: 1,
    limit: 25,
  },
  {
    // Verified 2026-11-24: Powergame WP REST API (200 OK).
    // Categories: 10584 = ENERGYGAME.GR, 960 = GREEN POWER, 962 = START-UPS & DIGITAL.
    id: "powergame-sector",
    name: "Powergame",
    type: "wordpress",
    tier: 4,
    url: "https://www.powergame.gr",
    categories: [10584, 960, 962],
    lookbackDays: 7,
    dayCap: 6,
    homeCap: 2,
    limit: 30,
  },
  {
    // Verified 2026-11-24: Euro2day Business & Deals RSS (200 OK).
    id: "euro2day-business",
    name: "Euro2day",
    type: "rss",
    tier: 4,
    url: "https://www.euro2day.gr/rss.ashx?catid=124",
    dayCap: 6,
    homeCap: 2,
    limit: 50,
  },
  {
    // Narrower FTTH/5G/telecom Google News query replacing the disabled generic
    // google-news-greek-telco feed (spec §2.3 gnews-fibre); explicitly excludes TV listings.
    id: "gnews-fibre",
    name: "Google News – Telecom & Fibre",
    type: "rss",
    tier: 4,
    url: "https://news.google.com/rss/search?q=%28FTTH%20OR%20%22%CE%BF%CF%80%CF%84%CE%B9%CE%BA%CE%AE%20%CE%AF%CE%BD%CE%B1%22%20OR%20%22%CE%BF%CF%80%CF%84%CE%B9%CE%BA%CE%AD%CF%82%20%CE%AF%CE%BD%CE%B5%CF%82%22%20OR%20FiberGrid%20OR%20%22United%20Fiber%22%20OR%20Inalan%20OR%20%22Gigabit%20Voucher%22%20OR%20%22private%205G%22%20OR%20%CE%95%CE%95%CE%A4%CE%A4%29%20%28%CE%95%CE%BB%CE%BB%CE%AC%CE%B4%CE%B1%20OR%20%CE%9F%CE%A4%CE%95%20OR%20Cosmote%20OR%20Vodafone%20OR%20Nova%20OR%20%CE%94%CE%95%CE%97%29%20-%CF%84%CE%B7%CE%BB%CE%B5%CF%8C%CF%81%CE%B1%CF%83%CE%B7%20-%CF%80%CF%81%CF%8C%CE%B3%CF%81%CE%B1%CE%BC%CE%BC%CE%B1%20-%CE%BA%CE%B1%CE%BD%CE%AC%CE%BB%CE%B9%CE%B1%20-%CE%9F%CF%85%CE%BA%CF%81%CE%B1%CE%BD%CE%AF%CE%B1&hl=el&gl=GR&ceid=GR%3Ael",
    sections: ["telecom-fibre"],
    dayCap: 6,
    homeCap: 2,
    limit: 40,
  },
];
