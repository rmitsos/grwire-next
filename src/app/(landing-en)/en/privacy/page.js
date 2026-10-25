import { getLandingCopy } from "@/landing/copy";
import { buildLandingMetadata } from "@/landing/metadata";
import { SimpleHeader } from "@/components/landing/SimpleHeader";

export const metadata = buildLandingMetadata({
  lang: "en",
  routeKey: "privacy",
  title: "GR Wire — Privacy policy",
  description: "What data we keep when you subscribe to GR Wire's weekly email.",
});

export default function Page() {
  const copy = getLandingCopy("en").privacy;
  return (
    <>
      <SimpleHeader lang="en" routeKey="privacy" />
      <main className="wrap simple-page">
        <h1>{copy.title}</h1>
        <p>{copy.body}</p>
        {/* Data controller: TBD. */}
        <a className="back-link" href="/en/subscribe">
          {copy.backLink}
        </a>
      </main>
    </>
  );
}
