/**
 * Initial source registry. Disabled entries are documented targets whose
 * exact endpoint must be verified before production use.
 */
export const SOURCES = [
  {
    id: "gdelt-greek-telco",
    type: "gdelt",
    url: "https://api.gdeltproject.org/api/v2/doc/doc",
    query: '(OTE OR Cosmote OR Vodafone OR Nova OR "PPC Fiber" OR "United Fiber" OR EETT) (FTTH OR fiber OR fibre OR 5G OR broadband OR spectrum OR network)',
    timespan: "7days",
    limit: 125,
  },
  {
    id: "gdelt-greek-energy",
    type: "gdelt",
    url: "https://api.gdeltproject.org/api/v2/doc/doc",
    query: '(ADMIE OR IPTO OR HEDNO OR DESFA OR RAAEY OR PPC OR DEPA) (grid OR substation OR interconnection OR storage OR renewable OR electricity OR gas)',
    timespan: "7days",
    limit: 125,
  },
  {
    id: "gdelt-greek-finance",
    type: "gdelt",
    url: "https://api.gdeltproject.org/api/v2/doc/doc",
    query: '("Alpha Bank" OR Eurobank OR "National Bank of Greece" OR "Piraeus Bank" OR ATHEX OR "Athens Stock Exchange") (results OR earnings OR dividend OR acquisition OR bond OR loan OR capital)',
    timespan: "7days",
    limit: 125,
  },
  {
    id: "gdelt-greek-infrastructure",
    type: "gdelt",
    url: "https://api.gdeltproject.org/api/v2/doc/doc",
    query: '(Greece OR Greek) (infrastructure OR construction OR concession OR railway OR motorway OR "data center" OR subsea cable)',
    timespan: "7days",
    limit: 125,
  },
  {
    id: "ot-wordpress",
    type: "wordpress",
    url: "https://www.ot.gr",
    lookbackDays: 7,
    limit: 100,
  },
  {
    id: "energypress-wordpress",
    type: "wordpress",
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
    id: "ot-gr",
    type: "rss",
    url: "https://www.ot.gr/feed/",
  },
];
