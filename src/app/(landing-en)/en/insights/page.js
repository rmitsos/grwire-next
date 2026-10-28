import { buildAlternatesMetadata } from "@/landing/metadata";
import { listInsights, insightsIndexPath } from "@/insights/content";
import { InsightIndexPage } from "@/components/insights/InsightIndexPage";

export const revalidate = 3600;

const insights = listInsights("en");
const allDraft = !insights.some((insight) => !insight.draft);

export const metadata = buildAlternatesMetadata({
  lang: "en",
  elPath: insightsIndexPath("el"),
  enPath: insightsIndexPath("en"),
  title: "Insights — GR Wire",
  description: "Sourced analysis on telecom, energy and infrastructure in Greece.",
  noindex: allDraft,
});

export default function Page() {
  return <InsightIndexPage lang="en" insights={insights} />;
}
