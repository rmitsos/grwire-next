import { buildAlternatesMetadata } from "@/landing/metadata";
import { getPublicCopy } from "@/landing/public-copy";
import { LANDING_ROUTES } from "@/landing/routes";
import { HomePage } from "@/components/public/HomePage";

// Served from the cache and rebuilt at most once an hour, or straight after an
// ingest (see /api/ingest). Rendering per request kept Neon awake around the clock.
export const revalidate = 3600;

const { title, description } = getPublicCopy("el").metadata.home;

export const metadata = buildAlternatesMetadata({
  lang: "el",
  elPath: LANDING_ROUTES.el.home,
  enPath: LANDING_ROUTES.en.home,
  title,
  description,
});

export default function Page() {
  return <HomePage lang="el" />;
}
