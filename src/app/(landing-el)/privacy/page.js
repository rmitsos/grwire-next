import { getLandingCopy } from "@/landing/copy";
import { buildLandingMetadata } from "@/landing/metadata";
import { SimpleHeader } from "@/components/landing/SimpleHeader";

export const metadata = buildLandingMetadata({
  lang: "el",
  routeKey: "privacy",
  title: "GR Wire — Πολιτική απορρήτου",
  description: "Τι στοιχεία κρατάμε όταν εγγράφεστε στο ημερήσιο email του GR Wire, ποιος τα επεξεργάζεται και για πόσο.",
});

export default function Page() {
  const contactEmail = process.env.NEWSLETTER_CONTACT_EMAIL || null;
  const copy = getLandingCopy("el").privacy;
  return (
    <>
      <SimpleHeader lang="el" routeKey="privacy" />
      <main className="wrap simple-page">
        <h1>{copy.title}</h1>
        <p>{copy.body}</p>
        <ul>
          {copy.details.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        {contactEmail && (
          <p>
            {copy.contactLabel} <a href={`mailto:${contactEmail}`}>{contactEmail}</a>
          </p>
        )}
        <a className="back-link" href="/subscribe">
          {copy.backLink}
        </a>
      </main>
    </>
  );
}
