import { notFound } from "next/navigation";
import { buildAlternatesMetadata, siteBase } from "@/landing/metadata";
import { getInsight, insightStaticParams, insightPath } from "@/insights/content";
import { InsightArticlePage } from "@/components/insights/InsightArticlePage";

export const dynamicParams = false;

export function generateStaticParams() {
  return insightStaticParams("en");
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const insight = getInsight(slug, "en");
  if (!insight) return {};

  const image = insight.chart ? `${siteBase()}${insight.chart.src}` : undefined;

  return buildAlternatesMetadata({
    lang: "en",
    elPath: insightPath(slug, "el"),
    enPath: insightPath(slug, "en"),
    title: `${insight.title} — GR Wire`,
    description: insight.description,
    image,
    type: "article",
    noindex: insight.draft,
  });
}

export default async function Page({ params }) {
  const { slug } = await params;
  const insight = getInsight(slug, "en");
  if (!insight) notFound();
  return <InsightArticlePage lang="en" insight={insight} />;
}
