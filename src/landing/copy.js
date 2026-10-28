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
  },
  en: {
    "check-inbox": { tone: "ok", text: "Almost done. Check your inbox and click the confirmation link." },
    "invalid-email": { tone: "error", text: "That address doesn't look right. Please try again." },
    "consent-required": { tone: "error", text: "Please accept the consent terms to subscribe." },
    unavailable: { tone: "error", text: "Sign-up isn't available right now. Please try again later." },
    "invalid-link": { tone: "error", text: "This confirmation link is invalid or has expired." },
    error: { tone: "error", text: "Something went wrong. Please try again." },
    done: { tone: "ok", text: "You have been unsubscribed." },
  },
};

export const LANDING_COPY = {
  el: {
    lang: "el",
    header: {
      wordmark: "GR WIRE",
      navSections: SECTION_LABELS,
      subscribeButton: "Εγγραφή",
    },
    hero: {
      chip: "Τηλεπικοινωνίες & Οπτικές Ίνες",
      headlineMain: "Η ελληνική αγορά τηλεπικοινωνιών και ίνας, σε ένα email την εβδομάδα.",
      headlineSoft: "Μόνο στοιχεία με πηγή.",
      lead: "Ένα email κάθε εβδομάδα με τα σημαντικά της αγοράς, τις αποφάσεις των ρυθμιστών και τους μεγάλους διαγωνισμούς. Κάθε αριθμός έχει πηγή και ημερομηνία.",
      teaserSoon: "Σύντομα",
      teaserNote: "Η πρώτη σειρά του GR Wire ξεκινά σύντομα.",
      // landing-copy.md, "Context line for LinkedIn arrivals" — verbatim, split around the link text.
      fromLinkedIn: { before: "Ήρθατε από μια ανάρτηση στο LinkedIn; Η πλήρης ανάλυση βρίσκεται ", link: "εδώ →", after: "." },
    },
    subscribeForm: {
      fieldLabel: "Το email σας",
      placeholder: "onoma@etaireia.gr",
      button: "Εγγραφή",
      freeNote: "Δωρεάν. Ένα email την εβδομάδα.",
      consentText: CONSENT_TEXT.el,
      privacyLinkLabel: "Πολιτική απορρήτου",
    },
    series: {
      kicker: "Ξεκινάμε με",
      title: "Η πρώτη σειρά: η ίνα στην Ελλάδα, σε τρεις ερωτήσεις",
      intro: "Τρία σύντομα κείμενα, ένα κάθε εβδομάδα. Το καθένα ξεκινά από μια ερώτηση και απαντά με στοιχεία.",
      items: [
        { n: "1/3", question: "Πώς προχωρά η ανάπτυξη της οπτικής ίνας;" },
        { n: "2/3", question: "Πληρώνουν πράγματι οι συνδρομητές για ίνα;" },
        { n: "3/3", question: "Νιώθουμε την ταχύτητα; Router, Wi-Fi και πακέτο" },
      ],
      soon: "Σύντομα",
      cta: "Λάβετε τη σειρά στο email σας →",
    },
    whatYouGet: {
      title: "Τι λαμβάνετε",
      items: [
        {
          title: "Ένα Insight την εβδομάδα",
          text: "Ένα θέμα, εξηγημένο: τα βασικά νούμερα με πηγή, τι σημαίνει για παρόχους, αναδόχους και επιχειρήσεις, τι να παρακολουθήσουμε.",
        },
        {
          title: "Η ημερήσια σύνοψη",
          text: "3–5 σημεία κάθε πρωί στο grwire.com, το καθένα με σύνδεσμο στην πηγή. Τα πιο σημαντικά της εβδομάδας μπαίνουν στο email.",
        },
        {
          title: "Ρυθμιστές και διαγωνισμοί",
          text: "Διαβουλεύσεις της ΕΕΤΤ με ημερομηνία λήξης και διαγωνισμοί άνω των 500.000 € από ΚΗΜΔΗΣ και Διαύγεια: φορέας, αντικείμενο, ποσό, προθεσμία.",
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
      title: "Μία φορά την εβδομάδα, πέντε λεπτά.",
      intro: "Ξεκινάμε με τη σειρά για την οπτική ίνα. Ακολουθούν θέματα από τους ρυθμιστές.",
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
      // subscribe-flow.md, "Privacy page line (EL)" — verbatim, nothing added.
      body: "Κρατάμε μόνο τη διεύθυνση email σας και την ημερομηνία που συμφωνήσατε, για να σας στέλνουμε το εβδομαδιαίο email του GR Wire. Δεν τη μοιραζόμαστε με τρίτους, εκτός από την υπηρεσία που στέλνει τα email για λογαριασμό μας. Μπορείτε να διαγραφείτε ή να ζητήσετε τη διαγραφή των στοιχείων σας όποτε θέλετε.",
      backLink: "← Πίσω στην αρχική",
    },
    unsubscribe: {
      title: "Διαγραφή από το email του GR Wire",
      intro: "Πατήστε το παρακάτω κουμπί για να διαγραφείτε από το εβδομαδιαίο email του GR Wire. Η ενέργεια αυτή δεν μπορεί να αναιρεθεί.",
      button: "Διαγραφή",
      missingToken: "Ο σύνδεσμος διαγραφής δεν είναι έγκυρος.",
      backLink: "← Πίσω στην αρχική",
    },
    confirmed: {
      title: "Η εγγραφή σας επιβεβαιώθηκε",
      body: "Είστε στη λίστα. Θα λαμβάνετε το εβδομαδιαίο email του GR Wire, με δυνατότητα διαγραφής όποτε θέλετε.",
      backLink: "← Πίσω στην αρχική",
    },
    statusMessages: STATUS_MESSAGES.el,
  },
  en: {
    lang: "en",
    header: {
      wordmark: "GR WIRE",
      navSections: SECTION_LABELS,
      subscribeButton: "Subscribe",
    },
    hero: {
      chip: "Telecom & fibre",
      headlineMain: "Greek telecom and fibre in one weekly email.",
      headlineSoft: "Only sourced facts.",
      lead: "One email a week with the main market news, regulator decisions and large tenders. Every figure carries its source and date.",
      teaserSoon: "Coming soon",
      teaserNote: "GR Wire's first series starts soon.",
      // landing-copy.md, "Context line for LinkedIn arrivals" — verbatim, split around the link text.
      fromLinkedIn: { before: "Came from a LinkedIn post? The full analysis is ", link: "here →", after: "." },
    },
    subscribeForm: {
      fieldLabel: "Your email",
      placeholder: "name@company.com",
      button: "Subscribe",
      freeNote: "Free. One email a week.",
      consentText: CONSENT_TEXT.en,
      privacyLinkLabel: "Privacy policy",
    },
    series: {
      kicker: "Starting with",
      title: "The first series: fibre in Greece, in three questions",
      intro: "Three short pieces, one a week. Each starts with a question and answers it with data.",
      items: [
        { n: "1/3", question: "How is the fibre rollout progressing?" },
        { n: "2/3", question: "Do subscribers actually pay for fibre?" },
        { n: "3/3", question: "Do we actually feel the speed? Router, Wi-Fi and plan tier" },
      ],
      soon: "Coming soon",
      cta: "Get the series by email →",
    },
    whatYouGet: {
      title: "What you get",
      items: [
        {
          title: "One Insight a week",
          text: "One topic, explained: the key figures with sources, what it means for operators, contractors and businesses, and what to watch.",
        },
        {
          title: "The daily brief",
          text: "3–5 points every morning on grwire.com, each linked to its source. The week's most important ones go into the email.",
        },
        {
          title: "Regulators and tenders",
          text: "EETT consultations with closing dates, and tenders above €500k from KIMDIS and Diavgeia: buyer, object, value, deadline.",
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
      title: "Once a week, five minutes.",
      intro: "We start with the fibre series. Regulation topics follow.",
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
      // subscribe-flow.md, "Privacy page line (EN)" — verbatim, nothing added.
      body: "We keep only your email address and the date you agreed, to send you GR Wire's weekly email. We don't share it with anyone except the service that sends the emails for us. You can unsubscribe or ask us to delete your data at any time.",
      backLink: "← Back to the homepage",
    },
    unsubscribe: {
      title: "Unsubscribe from GR Wire's email",
      intro: "Click the button below to unsubscribe from GR Wire's weekly email. This can't be undone.",
      button: "Unsubscribe",
      missingToken: "This unsubscribe link isn't valid.",
      backLink: "← Back to the homepage",
    },
    confirmed: {
      title: "Your subscription is confirmed",
      body: "You're on the list. You'll receive GR Wire's weekly email, and you can unsubscribe at any time.",
      backLink: "← Back to the homepage",
    },
    statusMessages: STATUS_MESSAGES.en,
  },
};

// Privacy policy explicitly leaves the data-controller identity open (subscribe-flow.md doesn't
// name one yet) — recorded here only as a build-time note, never rendered.
// Data controller: TBD.

export function getLandingCopy(lang) {
  return LANDING_COPY[lang === "en" ? "en" : "el"];
}
