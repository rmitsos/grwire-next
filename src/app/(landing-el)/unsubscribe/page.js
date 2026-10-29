import { buildLandingMetadata } from "@/landing/metadata";
import { UnsubscribeView } from "@/components/landing/UnsubscribeView";

export const metadata = buildLandingMetadata({
  lang: "el",
  routeKey: "unsubscribe",
  title: "GR Wire — Διαγραφή",
  description: "Διαγραφή από το ημερήσιο email του GR Wire.",
  noindex: true,
});

export default function Page({ searchParams }) {
  return <UnsubscribeView lang="el" searchParams={searchParams} />;
}
