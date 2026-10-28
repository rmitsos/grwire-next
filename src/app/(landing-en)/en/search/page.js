import { buildAlternatesMetadata } from "@/landing/metadata";
import { getPublicCopy } from "@/landing/public-copy";
import { LANDING_ROUTES } from "@/landing/routes";
import { SearchPage } from "@/components/public/SearchPage";

export const dynamic = "force-dynamic";

const { title, description } = getPublicCopy("en").metadata.search;

export const metadata = buildAlternatesMetadata({
  lang: "en",
  elPath: LANDING_ROUTES.el.search,
  enPath: LANDING_ROUTES.en.search,
  title,
  description,
});

export default function Page({ searchParams }) {
  return <SearchPage lang="en" searchParams={searchParams} />;
}
