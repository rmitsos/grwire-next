// EL/EN copy for the public wire pages (homepage, section pages, search). Mirrors the shape of
// src/landing/copy.js and src/insights/copy.js. EL is the default language.
import { LANDING_COPY } from "./copy.js";

export const PUBLIC_COPY = {
  el: {
    lang: "el",
    masthead: {
      title: "Το ελληνικό wire υποδομών.",
      lead: "Τηλεπικοινωνίες, ενέργεια και υποδομές — φιλτραρισμένες για ό,τι αλλάζει αγορές, επενδύσεις και έργα.",
    },
    leadLabel: "Κύρια είδηση",
    insightLabel: "Insight",
    insightRead: "Διαβάστε την ανάλυση →",
    insightAll: "Όλα τα Insights →",
    latestLabel: "Τελευταία",
    latestTitle: "Σε όλη την αγορά",
    searchLink: "Αναζήτηση στο wire →",
    viewAll: "Δείτε όλα →",
    home: {
      sectionsLabel: "Ενότητες",
      sectionsTitle: "Το wire ανά θέμα",
      sectionLatest: "Τελευταία:",
      insightsLabel: "Insights",
      insightsTitle: "Περισσότερες αναλύσεις",
      signupLabel: "Newsletter",
    },
    empty: "Δεν υπάρχουν ακόμη ειδήσεις σε αυτήν την ενότητα.",
    emptyRecent: "Δεν υπάρχουν ειδήσεις τις τελευταίες 72 ώρες.",
    emptySearch: "Δεν βρέθηκαν αποτελέσματα.",
    viaGoogleNews: "μέσω Google News (ο αρχικός σύνδεσμος δεν είναι διαθέσιμος)",
    section: {
      label: "GR WIRE",
      recentLabel: "Τελευταία",
      recentTitle: "Τελευταίες 72 ώρες",
      olderLabel: "Παλαιότερη κάλυψη",
      olderTitle: "Δημοσιεύτηκαν νωρίτερα",
      items: (count) => (count === 1 ? "1 είδηση" : `${count} ειδήσεις`),
    },
    search: {
      label: "Αρχείο",
      title: "Αναζήτηση στο wire",
      placeholder: "Εταιρεία, έργο ή θέμα αγοράς",
      allSections: "Όλες οι ενότητες",
      button: "Αναζήτηση",
      resultsLabel: "Αποτελέσματα",
      storiesLabel: "Αρχείο ιστοριών",
      storiesTitle: "Προηγούμενες ημερήσιες ιστορίες",
      found: (count) => (count === 1 ? "1 αποτέλεσμα" : `${count} αποτελέσματα`),
    },
    story: {
      label: "Ημερήσια ιστορία αγοράς",
      back: "Πίσω στην αρχική",
      evidenceLabel: "Τεκμήρια",
      evidenceCount: (count) => (count === 1 ? "1 συνδεδεμένο τεκμήριο" : `${count} συνδεδεμένα τεκμήρια`),
    },
    sectionDecks: {
      deals: "Πάροχοι, εταιρείες κοινής ωφέλειας, πύργοι, ίνα, δίκτυα και υποδομές: συμφωνίες, αποτελέσματα, συγχωνεύσεις και επενδύσεις.",
      telco: "Οπτική ίνα, δίκτυα κινητής, ρύθμιση και ψηφιακές υποδομές.",
      energy: "Δίκτυα ηλεκτρισμού, αποθήκευση, διασυνδέσεις και ενεργειακές επενδύσεις.",
      infrastructure: "Κατασκευές, παραχωρήσεις, μεταφορές, data centers και στρατηγικά έργα.",
      tenders: "Διαγωνισμοί και συμβάσεις από ΚΗΜΔΗΣ/Διαύγεια, και δημοσιεύματα για συγκεκριμένο διαγωνισμό.",
      regulators: "Αποφάσεις και διαβουλεύσεις ΕΕΤΤ, ΡΑΑΕΥ και υπουργείων, ρυθμιστικό πλαίσιο και πολιτική φάσματος.",
    },
    metadata: {
      home: {
        title: "GR Wire — Το ελληνικό wire υποδομών",
        description: "Ειδήσεις για τις τηλεπικοινωνίες, την ενέργεια και τις υποδομές στην Ελλάδα, με σύνδεσμο στην πηγή.",
      },
      search: { title: "Αναζήτηση — GR Wire", description: "Αναζητήστε στο αρχείο ειδήσεων του GR Wire." },
    },
    dateLocale: "el-GR",
  },
  en: {
    lang: "en",
    masthead: {
      title: "The Greek infrastructure wire.",
      lead: "Telecommunications, energy and infrastructure — filtered for what changes markets, investment and delivery.",
    },
    leadLabel: "Lead story",
    insightLabel: "Insight",
    insightRead: "Read the analysis →",
    insightAll: "All insights →",
    latestLabel: "Latest",
    latestTitle: "Across the market",
    searchLink: "Search the wire →",
    viewAll: "View all →",
    home: {
      sectionsLabel: "Sections",
      sectionsTitle: "The wire by topic",
      sectionLatest: "Latest:",
      insightsLabel: "Insights",
      insightsTitle: "More analysis",
      signupLabel: "Newsletter",
    },
    empty: "No stories in this section yet.",
    emptyRecent: "No stories in the last 72 hours.",
    emptySearch: "No matching stories were found.",
    viaGoogleNews: "via Google News (original link not available)",
    section: {
      label: "GR WIRE",
      recentLabel: "Latest",
      recentTitle: "Last 72 hours",
      olderLabel: "Older coverage",
      olderTitle: "Previously published",
      items: (count) => (count === 1 ? "1 story" : `${count} stories`),
    },
    search: {
      label: "Archive",
      title: "Search the wire",
      placeholder: "Company, project or market theme",
      allSections: "All sections",
      button: "Search",
      resultsLabel: "Results",
      storiesLabel: "Story archive",
      storiesTitle: "Previous daily stories",
      found: (count) => (count === 1 ? "1 result" : `${count} results`),
    },
    story: {
      label: "Daily market story",
      back: "Back to the homepage",
      evidenceLabel: "Evidence",
      evidenceCount: (count) => (count === 1 ? "1 linked evidence item" : `${count} linked evidence items`),
    },
    sectionDecks: {
      deals: "Operators, utilities, towers, fibre, grid and infrastructure companies: deals, results, M&A and investment.",
      telco: "Fibre, mobile networks, regulation and digital infrastructure.",
      energy: "Power grids, storage, interconnections and energy investment.",
      infrastructure: "Construction, concessions, transport, data centres and strategic projects.",
      tenders: "KIMDIS/Diavgeia tenders and contracts, and press coverage of a specific tender.",
      regulators: "EETT, RAAEY and ministry decisions, consultations, regulation and spectrum policy.",
    },
    metadata: {
      home: {
        title: "GR Wire — The Greek infrastructure wire",
        description: "News on telecom, energy and infrastructure in Greece, linked to the original source.",
      },
      search: { title: "Search — GR Wire", description: "Search the GR Wire news archive." },
    },
    dateLocale: "en-GB",
  },
};

export function getPublicCopy(lang) {
  return PUBLIC_COPY[lang === "en" ? "en" : "el"];
}

export function sectionTitle(slug, lang) {
  return LANDING_COPY[lang === "en" ? "en" : "el"].header.navSections[slug]?.[lang === "en" ? "en" : "el"] ?? slug;
}

export function formatWireDate(value, lang) {
  if (!value) return "—";
  return new Intl.DateTimeFormat(getPublicCopy(lang).dateLocale, {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Athens",
  }).format(new Date(value));
}

export function formatMastheadDate(value, lang) {
  return new Intl.DateTimeFormat(getPublicCopy(lang).dateLocale, { dateStyle: "full", timeZone: "Europe/Athens" }).format(value);
}
