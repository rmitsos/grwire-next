// Centralised EL/EN copy for the landing/subscribe pages. Source: landing-copy.md and
// subscribe-flow.md in /workspace/knowledge/grwire/landing (25 Oct 2026 draft).
//
// The consent paragraph is imported from src/newsletter/service.js rather than duplicated here,
// since that exact text is what CONSENT_TEXT_VERSION records as having been shown to the user —
// the landing page and the stored consent record must never drift apart.
import { CONSENT_TEXT } from "../newsletter/service.js";

export const NAV_SECTIONS = [
  { slug: "telco", path: "/telco", color: "var(--sec-telecom-fibre)", primary: true },
  { slug: "energy", path: "/energy", color: "var(--sec-energy-grids)" },
  { slug: "infrastructure", path: "/infrastructure", color: "var(--sec-infrastructure-works)" },
  { slug: "tenders", path: "/tenders", color: "var(--sec-tenders-contracts)" },
  { slug: "regulators", path: "/regulators", color: "var(--sec-regulators-policy)" },
  { slug: "deals", path: "/deals", color: "var(--sec-deals-companies)" },
];

const SECTION_LABELS = {
  telco: { el: "Τηλεπικοινωνίες & Οπτικές Ίνες", en: "Telecom & fibre" },
  energy: { el: "Ενέργεια & Δίκτυα", en: "Energy & grids" },
  infrastructure: { el: "Υποδομές & Έργα", en: "Infrastructure & works" },
  tenders: { el: "Διαγωνισμοί & Συμβάσεις", en: "Tenders & contracts" },
  regulators: { el: "Ρυθμιστές & Πολιτική", en: "Regulators & policy" },
  deals: { el: "Συμφωνίες & Εταιρείες", en: "Deals & companies" },
};

// Statuses the newsletter API can redirect back with via ?status=. check-inbox / invalid-email /
// consent-required are from landing-copy.md §2; unavailable / invalid-link / error / done have no
// copy in the draft (nothing in the mockup needed them) and were written here, short and neutral.
const STATUS_MESSAGES = {
  el: {
    "check-inbox": { tone: "ok", text: "Σχεδόν έτοιμο. Ελέγξτε το email σας και πατήστε τον σύνδεσμο επιβεβαίωσης." },
    "invalid-email": { tone: "error", text: "Αυτή η διεύθυνση δεν φαίνεται σωστή. Δοκιμάστε ξανά." },
    "consent-required": { tone: "error", text: "Πρέπει να αποδεχτείτε τους όρους για να εγγραφείτε." },
    unavailable: { tone: "error", text: "Η εγγραφή δεν είναι διαθέσιμη αυτή τη στιγμή. Δοκιμάστε ξανά αργότερα." },
    "invalid-link": { tone: "error", text: "Ο σύνδεσμος επιβεβαίωσης δεν είναι έγκυρος ή έχει λήξει." },
    error: { tone: "error", text: "Κάτι πήγε στραβά. Δοκιμάστε ξανά." },
    done: { tone: "ok", text: "Έχετε διαγραφεί από τη λίστα." },
    "already-confirmed": { tone: "ok", text: "Η εγγραφή σας έχει ήδη επιβεβαιωθεί. Δεν χρειάζεται να κάνετε κάτι άλλο." },
    "already-unsubscribed": { tone: "ok", text: "Έχετε ήδη διαγραφεί από τη λίστα." },
    "invalid-unsubscribe": { tone: "error", text: "Ο σύνδεσμος διαγραφής δεν είναι έγκυρος." },
  },
  en: {
    "check-inbox": { tone: "ok", text: "Almost done. Check your inbox and click the confirmation link." },
    "invalid-email": { tone: "error", text: "That address doesn't look right. Please try again." },
    "consent-required": { tone: "error", text: "Please accept the consent terms to subscribe." },
    unavailable: { tone: "error", text: "Sign-up isn't available right now. Please try again later." },
    "invalid-link": { tone: "error", text: "This confirmation link is invalid or has expired." },
    error: { tone: "error", text: "Something went wrong. Please try again." },
    done: { tone: "ok", text: "You have been unsubscribed." },
    "already-confirmed": { tone: "ok", text: "Your subscription is already confirmed. There's nothing more to do." },
    "already-unsubscribed": { tone: "ok", text: "You have already been unsubscribed." },
    "invalid-unsubscribe": { tone: "error", text: "This unsubscribe link isn't valid." },
  },
};

export const LANDING_COPY = {
  el: {
    lang: "el",
    header: {
      wordmark: "GR WIRE",
      navSections: SECTION_LABELS,
      subscribeButton: "Εγγραφή",
      searchLabel: "Αναζήτηση",
      insightsLabel: "Insights",
    },
    hero: {
      chip: "Τηλεπικοινωνίες & Οπτικές Ίνες",
      headlineMain: "Τηλεπικοινωνίες στην Ελλάδα: δίκτυα σταθερής και κινητής, και δορυφορική επικοινωνία, κάθε πρωί.",
      headlineSoft: "Μόνο στοιχεία με πηγή.",
      lead: "Κάθε εργάσιμη ένα σύντομο email με τα νέα της αγοράς, τις αποφάσεις των ρυθμιστών και τους διαγωνισμούς, μαζί με το σχόλιό μας για το τι σημαίνουν. Κάθε αριθμός έχει πηγή και ημερομηνία.",
      signupClosed: "Η εγγραφή ανοίγει σύντομα.",
      // landing-copy.md, "Context line for LinkedIn arrivals" — verbatim, split around the link text.
      fromLinkedIn: { before: "Ήρθατε από μια ανάρτηση στο LinkedIn; Η πλήρης ανάλυση βρίσκεται ", link: "εδώ →", after: "." },
    },
    subscribeForm: {
      fieldLabel: "Το email σας",
      placeholder: "onoma@etaireia.gr",
      button: "Εγγραφή",
      freeNote: "Δωρεάν. Χωρίς διαφημίσεις.",
      consentText: CONSENT_TEXT.el,
      privacyLinkLabel: "Πολιτική απορρήτου",
      // Shown in place of the browser's own (English) validation bubbles.
      emailMissing: "Συμπληρώστε το email σας.",
      emailInvalid: "Αυτή η διεύθυνση δεν φαίνεται σωστή. Δοκιμάστε ξανά.",
      consentRequired: "Πρέπει να αποδεχτείτε τους όρους για να εγγραφείτε.",
    },
    whatYouGet: {
      title: "Τι λαμβάνετε",
      items: [
        {
          title: "Η ημερήσια ενημέρωση",
          text: "Κάθε εργάσιμη το πρωί, τα σημαντικά της αγοράς, καθένα με σύνδεσμο στην πηγή και με λίγες γραμμές σχόλιο για το τι σημαίνει.",
        },
        {
          title: "Τα Insights μας",
          text: "Όταν δημοσιεύουμε ένα Insight, μπαίνει στο email της ημέρας: ένα θέμα εξηγημένο, με τα βασικά νούμερα και την πηγή τους.",
        },
        {
          title: "Ρυθμιστές και διαγωνισμοί",
          text: "Διαβουλεύσεις της ΕΕΤΤ με ημερομηνία λήξης και διαγωνισμοί άνω των 500.000 € από ΚΗΜΔΗΣ και Διαύγεια: φορέας, αντικείμενο, ποσό, προθεσμία.",
        },
        {
          title: "Χωρίς διαφημίσεις",
          text: "Δεν φιλοξενούμε διαφημίσεις ούτε χορηγούμενο περιεχόμενο. Το GR Wire το εκδίδει η Tareno Systems.",
        },
      ],
    },
    samples: {
      title: "Ένα δείγμα",
      note: "Δείγματα μορφής. Τα στοιχεία είναι πραγματικά, με την πηγή και την ημερομηνία τους.",
      badge: "ΔΕΙΓΜΑ",
    },
    howWeWork: {
      title: "Πώς δουλεύουμε",
      items: [
        { title: "Κάθε αριθμός έχει πηγή και ημερομηνία", text: "Αν δεν μπορούμε να τον ελέγξουμε, δεν τον δημοσιεύουμε." },
        { title: "Δεν κρίνουμε εταιρείες", text: "Μεταφέρουμε τι έγινε και τι σημαίνει, όχι ποιος έχει δίκιο." },
        { title: "Πρώτα οι επίσημες πηγές", text: "ΕΕΤΤ, ΚΗΜΔΗΣ, Διαύγεια και ανακοινώσεις εταιρειών, με σύνδεσμο στο πρωτότυπο." },
        { title: "Χωρίς παρακολούθηση", text: "Δεν μετράμε ανοίγματα και κλικ στα email μας. Η διαγραφή γίνεται με ένα κλικ." },
      ],
    },
    cta2: {
      title: "Κάθε πρωί, πέντε λεπτά.",
    },
    footer: {
      wordmark: "GR WIRE",
      tagline: "Ειδήσεις και στοιχεία για τις τηλεπικοινωνίες, την ενέργεια και τις υποδομές στην Ελλάδα.",
      sectionsHeading: "Ενότητες",
      privacyLabel: "Πολιτική απορρήτου",
      fine: "Οι τίτλοι και τα στοιχεία ανήκουν στις πηγές τους, με σύνδεσμο στο πρωτότυπο. Διαγραφή από τη λίστα: σε κάθε email.",
    },
    privacy: {
      title: "Πολιτική απορρήτου",
      // subscribe-copy-v2.md, "Privacy line" — verbatim; `details` is the controller/processor/retention list.
      body: "Η Tareno Systems κρατά μόνο τη διεύθυνση email σας και την ημερομηνία που συμφωνήσατε, για να σας στέλνει το ημερήσιο email του GR Wire. Δεν τη μοιραζόμαστε με τρίτους, εκτός από την υπηρεσία που στέλνει τα email για λογαριασμό μας. Μπορείτε να διαγραφείτε ή να ζητήσετε τη διαγραφή των στοιχείων σας όποτε θέλετε.",
      details: [
        "Υπεύθυνος επεξεργασίας: Tareno Systems (Δημήτρης Ρούσσος), tarenosystems.com.",
        "Εκτελών την επεξεργασία: Amazon SES (Amazon Web Services), περιοχή ΕΕ (Φρανκφούρτη), μόνο για την αποστολή των email.",
        "Εγγραφές που δεν επιβεβαιώνονται διαγράφονται μέσα σε 7 ημέρες.",
        "Δεν μετράμε ανοίγματα ή κλικ στα email και δεν υπάρχουν διαφημίσεις.",
      ],
      contactLabel: "Για διαγραφή στοιχείων ή απορίες:",
      backLink: "← Πίσω στην αρχική",
    },
    unsubscribe: {
      title: "Διαγραφή από το email του GR Wire",
      intro: "Πατήστε το παρακάτω κουμπί για να διαγραφείτε από το ημερήσιο email του GR Wire. Η ενέργεια αυτή δεν μπορεί να αναιρεθεί.",
      button: "Διαγραφή",
      missingToken: "Ο σύνδεσμος διαγραφής δεν είναι έγκυρος.",
      backLink: "← Πίσω στην αρχική",
    },
    confirmed: {
      title: "Η εγγραφή σας επιβεβαιώθηκε",
      body: "Η εγγραφή σας επιβεβαιώθηκε. Το πρώτο email έρχεται το επόμενο εργάσιμο πρωί.",
      backLink: "← Πίσω στην αρχική",
    },
    notFound: {
      title: "Η σελίδα δεν βρέθηκε",
      body: "Ο σύνδεσμος που ακολουθήσατε δεν οδηγεί σε σελίδα του GR Wire. Μπορεί να έχει αλλάξει ή να έχει γραφτεί λάθος.",
      backLink: "← Πίσω στην αρχική",
      metaTitle: "GR Wire — Η σελίδα δεν βρέθηκε",
    },
    statusMessages: STATUS_MESSAGES.el,
  },
  en: {
    lang: "en",
    header: {
      wordmark: "GR WIRE",
      navSections: SECTION_LABELS,
      subscribeButton: "Subscribe",
      searchLabel: "Search",
      insightsLabel: "Insights",
    },
    hero: {
      chip: "Telecom & fibre",
      headlineMain: "Telecoms in Greece: fixed and mobile networks, and satellite communications, every morning.",
      headlineSoft: "Only sourced facts.",
      lead: "A short email every weekday with the market news, regulator decisions and tenders, plus our comment on what they mean. Every figure carries its source and date.",
      signupClosed: "Sign-up opens soon.",
      // landing-copy.md, "Context line for LinkedIn arrivals" — verbatim, split around the link text.
      fromLinkedIn: { before: "Came from a LinkedIn post? The full analysis is ", link: "here →", after: "." },
    },
    subscribeForm: {
      fieldLabel: "Your email",
      placeholder: "name@company.com",
      button: "Subscribe",
      freeNote: "Free. No ads.",
      consentText: CONSENT_TEXT.en,
      privacyLinkLabel: "Privacy policy",
      emailMissing: "Please enter your email address.",
      emailInvalid: "That address doesn't look right. Please try again.",
      consentRequired: "Please accept the consent terms to subscribe.",
    },
    whatYouGet: {
      title: "What you get",
      items: [
        {
          title: "The daily update",
          text: "Every weekday morning, the main market items, each linked to its source, with a few lines of comment on what it means.",
        },
        {
          title: "Our Insights",
          text: "When we publish an Insight, it goes into that day's email: one topic explained, with the key figures and their sources.",
        },
        {
          title: "Regulators and tenders",
          text: "EETT consultations with closing dates, and tenders above €500k from KIMDIS and Diavgeia: buyer, object, value, deadline.",
        },
        {
          title: "No ads",
          text: "We carry no advertising or sponsored content. GR Wire is published by Tareno Systems.",
        },
      ],
    },
    samples: {
      title: "A sample",
      note: "Format samples. The figures are real, with their source and date.",
      badge: "SAMPLE",
    },
    howWeWork: {
      title: "How we work",
      items: [
        { title: "Every figure has a source and a date", text: "If we can't check it, we don't publish it." },
        { title: "We don't judge companies", text: "We report what happened and what it means, not who is right." },
        { title: "Primary sources first", text: "EETT, KIMDIS, Diavgeia and company announcements, linked to the original." },
        { title: "No tracking", text: "We don't track opens or clicks in our emails. Unsubscribing takes one click." },
      ],
    },
    cta2: {
      title: "Every morning, five minutes.",
    },
    footer: {
      wordmark: "GR WIRE",
      tagline: "News and data on telecom, energy and infrastructure in Greece.",
      sectionsHeading: "Sections",
      privacyLabel: "Privacy policy",
      fine: "Headlines and data belong to their sources and link to the original. Unsubscribe: in every email.",
    },
    privacy: {
      title: "Privacy policy",
      // subscribe-copy-v2.md, "Privacy line" — verbatim; `details` is the controller/processor/retention list.
      body: "Tareno Systems keeps only your email address and the date you agreed, to send you GR Wire's daily email. We don't share it with anyone except the service that sends the emails for us. You can unsubscribe or ask us to delete your data at any time.",
      details: [
        "Data controller: Tareno Systems (Dimitris Roussos), tarenosystems.com.",
        "Processor: Amazon SES (Amazon Web Services), EU region (Frankfurt), used only to send the emails.",
        "Sign-ups that are never confirmed are deleted within 7 days.",
        "We don't track opens or clicks in our emails, and there are no ads.",
      ],
      contactLabel: "To have your data deleted, or with any question:",
      backLink: "← Back to the homepage",
    },
    unsubscribe: {
      title: "Unsubscribe from GR Wire's email",
      intro: "Click the button below to unsubscribe from GR Wire's daily email. This can't be undone.",
      button: "Unsubscribe",
      missingToken: "This unsubscribe link isn't valid.",
      backLink: "← Back to the homepage",
    },
    confirmed: {
      title: "Your subscription is confirmed",
      body: "You're subscribed. Your first email arrives on the next weekday morning.",
      backLink: "← Back to the homepage",
    },
    notFound: {
      title: "Page not found",
      body: "That link doesn't lead to a page on GR Wire. It may have moved, or been mistyped.",
      backLink: "← Back to the homepage",
      metaTitle: "GR Wire — Page not found",
    },
    statusMessages: STATUS_MESSAGES.en,
  },
};

export function getLandingCopy(lang) {
  return LANDING_COPY[lang === "en" ? "en" : "el"];
}
