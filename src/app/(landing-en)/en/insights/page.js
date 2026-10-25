import { buildAlternatesMetadata } from "@/landing/metadata";
import { listInsights, insightsIndexPath } from "@/insights/content";
import { InsightIndexPage } from "@/components/insights/InsightIndexPage";

export const revalidate = 3600;

export const metadata = buildAlternatesMetadata({
  lang: "en",
  elPath: insightsIndexPath("el"),
  enPath: insightsIndexPath("en"),
  title: "Insights — GR Wire",
  description: "Sourced analysis on telecom, energy and infrastructure in Greece.",
});

export default function Page() {
  return <InsightIndexPage lang="en" insights={listInsights("en")} />;
}
