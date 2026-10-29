import { notFound } from "next/navigation";
import { buildAlternatesMetadata } from "@/landing/metadata";
import { getPublicCopy, sectionTitle } from "@/landing/public-copy";
import { sectionPath } from "@/landing/routes";
import { PUBLIC_CATEGORIES } from "@/public-data";
import { SectionPage } from "@/components/public/SectionPage";

// Same caching as the homepage; only the known sections are built.
export const revalidate = 3600;
export const dynamicParams = false;

export function generateStaticParams() {
  return Object.keys(PUBLIC_CATEGORIES).map((category) => ({ category }));
}

export async function generateMetadata({ params }) {
  const { category } = await params;
  if (!PUBLIC_CATEGORIES[category]) return {};
  return buildAlternatesMetadata({
    lang: "en",
    elPath: sectionPath("el", category),
    enPath: sectionPath("en", category),
    title: `${sectionTitle(category, "en")} — GR Wire`,
    description: getPublicCopy("en").sectionDecks[category],
  });
}

export default async function Page({ params }) {
  const { category } = await params;
  if (!PUBLIC_CATEGORIES[category]) notFound();
  return <SectionPage lang="en" category={category} />;
}
