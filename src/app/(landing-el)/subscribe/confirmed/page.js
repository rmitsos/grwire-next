import { getLandingCopy } from "@/landing/copy";
import { buildLandingMetadata } from "@/landing/metadata";
import { SimpleHeader } from "@/components/landing/SimpleHeader";

export const metadata = buildLandingMetadata({
  lang: "el",
  routeKey: "confirmed",
  title: "GR Wire — Η εγγραφή επιβεβαιώθηκε",
  description: "Η εγγραφή σας στο εβδομαδιαίο email του GR Wire επιβεβαιώθηκε.",
  noindex: true,
});

export default function Page() {
  const copy = getLandingCopy("el").confirmed;
  return (
    <>
      <SimpleHeader lang="el" routeKey="confirmed" />
      <main className="wrap simple-page">
        <h1>{copy.title}</h1>
        <p>{copy.body}</p>
        <a className="back-link" href="/subscribe">
          {copy.backLink}
        </a>
      </main>
    </>
  );
}
