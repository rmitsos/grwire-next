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
    // /feed/ only contains two 2022 "Τεστ" posts; the WP REST API needs auth
    // (401/403). This post-type feed is the working public feed (verified 25
    // Oct 2026, latest item 20 Oct 2026). Low volume (a few per month).
    id: "eett-announcements",
    type: "rss",
    url: "https://www.eett.gr/feed/?post_type=deltia_tipou",
    excludeTitlePatterns: ["^Τεστ"],
    limit: 100,
  },
  {
    // The HTML page https://www.raaey.gr/energeia/anakinoseis/ returns HTTP
    // 500; WP REST works (200). Categories 16/28 (Αδειοδοτήσεις/Αποφάσεις)
    // are excluded because they are thousands of boilerplate licensing
    // decisions ("ΑΠΟΦΑΣΗ ΑΝΤΙΠΡΟΕΔΡΟΥ ... ΥΠ' ΑΡΙΘΜ.").
    id: "raaey-energy-announcements",
    type: "wordpress",
    url: "https://www.raaey.gr/energeia",
    categories: [17, 20, 110],
    lookbackDays: 21,
    limit: 30,
  },
  {
    id: "ypen-energy-announcements",
    type: "html",
    url: "https://ypen.gov.gr/category/anakoinoseis-typou/",
    linkPatterns: ["energia", "ενεργ", "anakoin", "press"],
    limit: 100,
  },
  {
    id: "ggtt-telecom-announcements",
    type: "html",
    url: "https://ggtt.mindigital.gr/section/telecom",
    linkPatterns: ["telecom", "post", "news", "announcement", "τηλεπικ"],
    limit: 100,
  },
  {
    // 0 accepted of 35 fetched in the 25 Oct 2026 live scan (titles only, no
    // summary, rarely reach the relevance threshold). Covered by the "ot-gr"
    // WordPress source's category 294 (Τηλεπικοινωνίες), which has excerpts.
    id: "ot-telecoms",
    type: "html",
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
    url: "https://netweek.gr/category/telecoms/",
    linkPatterns: ["telecom", "ote", "cosmote", "vodafone", "nova", "ftth", "fiber", "fibre", "5g", "ufbb", "network", "connectivity", "τηλεπικ"],
    minimumTitleLength: 16,
    limit: 120,
  },
  {
    id: "naftemporiki-telecoms",
    type: "html",
    url: "https://www.naftemporiki.gr/tag/tilepikoinonies/",
    linkPatterns: ["tilepikoin", "telecom", "ote", "cosmote", "vodafone", "nova", "ftth", "fiber", "fibre", "5g", "network", "internet", "δικτυ", "κινητ"],
    minimumTitleLength: 16,
    limit: 120,
  },
  {
    id: "dnews-eett",
    type: "html",
    url: "https://www.dnews.gr/site/tag/%CE%95%CE%95%CE%A4%CE%A4",
    linkPatterns: ["eett", "%CE%95%CE%95%CE%A4%CE%A4", "eidhseis", "tilepikoin", "telecom", "mobile", "χρεω"],
    minimumTitleLength: 16,
    limit: 100,
  },
  {
    id: "intracom-telecom-press",
    type: "html",
    url: "https://www.intracom-telecom.com/en/news/press.htm",
    linkPatterns: ["/en/news/press/"],
    minimumTitleLength: 16,
    limit: 100,
  },
  {
    id: "energypress-wordpress",
    type: "wordpress",
    enabled: false,
    url: "https://energypress.gr",
    lookbackDays: 7,
    limit: 100,
  },
  {
    id: "ypodomes-wordpress",
    type: "wordpress",
    url: "https://ypodomes.com",
    lookbackDays: 7,
    limit: 100,
  },
  {
    id: "insider-wordpress",
    type: "wordpress",
    enabled: false,
    url: "https://www.insider.gr",
    lookbackDays: 7,
    limit: 100,
  },
  {
    id: "naftemporiki",
    type: "rss",
    url: "https://www.naftemporiki.gr/feed/",
  },
  {
    // The general /feed/ is dominated by world/politics/lifestyle (1 of 35
    // relevant in the 25 Oct 2026 scan); WP REST answers 200 with excerpts.
    id: "ot-gr",
    type: "wordpress",
    url: "https://www.ot.gr",
    categories: [7, 21, 294, 295],
    lookbackDays: 7,
    limit: 60,
  },
  {
    id: "google-news-greek-telco",
    type: "rss",
    url: "https://news.google.com/rss/search?q=%28OTE%20OR%20Cosmote%20OR%20Vodafone%20OR%20Nova%20OR%20Intracom%20OR%20FTTH%20OR%205G%20OR%20telecom%20OR%20%CF%84%CE%B7%CE%BB%CE%B5%CF%80%CE%B9%CE%BA%CE%BF%CE%B9%CE%BD%CF%89%CE%BD%CE%AF%CE%B5%CF%82%20OR%20%CE%95%CE%95%CE%A4%CE%A4%29%20Greece&hl=el&gl=GR&ceid=GR%3Ael",
    limit: 60,
  },
  {
    id: "google-news-greek-energy",
    type: "rss",
    url: "https://news.google.com/rss/search?q=%28ADMIE%20OR%20IPTO%20OR%20HEDNO%20OR%20DEDDIE%20OR%20RAAEY%20OR%20PPC%20OR%20renewable%20OR%20storage%29%20Greece&hl=el&gl=GR&ceid=GR%3Ael",
    limit: 60,
  },
];
