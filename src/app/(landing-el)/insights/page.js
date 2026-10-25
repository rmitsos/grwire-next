import { buildAlternatesMetadata } from "@/landing/metadata";
import { listInsights, insightsIndexPath } from "@/insights/content";
import { InsightIndexPage } from "@/components/insights/InsightIndexPage";

export const revalidate = 3600;

const insights = listInsights("el");
const allDraft = !insights.some((insight) => !insight.draft);

export const metadata = buildAlternatesMetadata({
  lang: "el",
  elPath: insightsIndexPath("el"),
  enPath: insightsIndexPath("en"),
  title: "Insights — GR Wire",
  description: "Ανάλυση με στοιχεία και πηγές για τις τηλεπικοινωνίες, την ενέργεια και τις υποδομές στην Ελλάδα.",
  noindex: allDraft,
});

export default function Page() {
  return <InsightIndexPage lang="el" insights={insights} />;
}
