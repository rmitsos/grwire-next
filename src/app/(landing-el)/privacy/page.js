import { getLandingCopy } from "@/landing/copy";
import { buildLandingMetadata } from "@/landing/metadata";
import { SimpleHeader } from "@/components/landing/SimpleHeader";

export const metadata = buildLandingMetadata({
  lang: "el",
  routeKey: "privacy",
  title: "GR Wire — Πολιτική απορρήτου",
  description: "Τι στοιχεία κρατάμε όταν εγγράφεστε στο εβδομαδιαίο email του GR Wire.",
});

export default function Page() {
  const copy = getLandingCopy("el").privacy;
  return (
    <>
      <SimpleHeader lang="el" routeKey="privacy" />
      <main className="wrap simple-page">
        <h1>{copy.title}</h1>
        <p>{copy.body}</p>
        {/* Data controller: TBD. */}
        <a className="back-link" href="/subscribe">
          {copy.backLink}
        </a>
      </main>
    </>
  );
}
