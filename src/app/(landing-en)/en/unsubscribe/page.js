import { buildLandingMetadata } from "@/landing/metadata";
import { UnsubscribeView } from "@/components/landing/UnsubscribeView";

export const metadata = buildLandingMetadata({
  lang: "en",
  routeKey: "unsubscribe",
  title: "GR Wire — Unsubscribe",
  description: "Unsubscribe from GR Wire's daily email.",
  noindex: true,
});

export default function Page({ searchParams }) {
  return <UnsubscribeView lang="en" searchParams={searchParams} />;
}
