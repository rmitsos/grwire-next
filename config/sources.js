/**
 * Initial source registry. Disabled entries are documented targets whose
 * exact endpoint must be verified before production use.
 */
export const SOURCES = [
  {
    id: "gdelt-greek-telco",
    type: "gdelt",
    url: "https://api.gdeltproject.org/api/v2/doc/doc",
    query: '(OTE OR Cosmote OR "PPC Fiber" OR EETT) (FTTH OR fiber OR 5G OR broadband)',
    timespan: "3days",
    limit: 75,
  },
  {
    id: "gdelt-greek-energy",
    type: "gdelt",
    url: "https://api.gdeltproject.org/api/v2/doc/doc",
    query: '(ADMIE OR IPTO OR HEDNO OR DESFA OR RAAEY) (grid OR substation OR interconnection OR storage)',
    timespan: "3days",
    limit: 75,
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
