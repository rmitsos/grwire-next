import { buildAlternatesMetadata } from "@/landing/metadata";
import { listInsights, insightsIndexPath } from "@/insights/content";
import { InsightIndexPage } from "@/components/insights/InsightIndexPage";

export const revalidate = 3600;

export const metadata = buildAlternatesMetadata({
  lang: "el",
  elPath: insightsIndexPath("el"),
  enPath: insightsIndexPath("en"),
  title: "Insights — GR Wire",
  description: "Ανάλυση με στοιχεία και πηγές για τις τηλεπικοινωνίες, την ενέργεια και τις υποδομές στην Ελλάδα.",
});

export default function Page() {
  return <InsightIndexPage lang="el" insights={listInsights("el")} />;
}
