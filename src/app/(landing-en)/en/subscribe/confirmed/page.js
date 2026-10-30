import { getLandingCopy } from "@/landing/copy";
import { buildLandingMetadata } from "@/landing/metadata";
import { SimpleHeader } from "@/components/landing/SimpleHeader";

export const metadata = buildLandingMetadata({
  lang: "en",
  routeKey: "confirmed",
  title: "GR Wire — Subscription confirmed",
  description: "Your subscription to GR Wire's weekday email is confirmed.",
  noindex: true,
});

export default function Page() {
  const copy = getLandingCopy("en").confirmed;
  return (
    <>
      <SimpleHeader lang="en" routeKey="confirmed" />
      <main className="wrap simple-page">
        <h1>{copy.title}</h1>
        <p>{copy.body}</p>
        <a className="back-link" href="/en/subscribe">
          {copy.backLink}
        </a>
      </main>
    </>
  );
}
