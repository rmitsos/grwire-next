import { notFound } from "next/navigation";
import { ArticleList } from "@/components/ArticleList";
import { getLatestArticles, PUBLIC_CATEGORIES } from "@/public-data";
import { splitByFreshness } from "@/feed-rules";

// Same caching as the homepage; only the four known sections are built.
export const revalidate = 3600;
export const dynamicParams = false;

export function generateStaticParams() {
  return Object.keys(PUBLIC_CATEGORIES).map((category) => ({ category }));
}

export async function generateMetadata({ params }) {
  const { category } = await params;
  const config = PUBLIC_CATEGORIES[category];
  return config ? { title: config.name, description: config.deck } : {};
}

export default async function CategoryPage({ params }) {
  const { category } = await params;
  const config = PUBLIC_CATEGORIES[category];
  if (!config) notFound();
  const articles = await getLatestArticles({ category, limit: 100 });
  // sources-spec.md §3 max_age_hours.news: the top of the page shows only
  // the last 72h; older matching coverage still exists, just lower down.
  const { fresh, older } = splitByFreshness(articles);

  return (
    <main className="public-main">
      <section className={`category-hero ${category}`}>
        <span className="section-label">GR WIRE / {category}</span>
        <h1>{config.name}</h1>
        <p>{config.deck}</p>
      </section>
      <section className="public-section">
        <div className="section-heading"><div><span className="section-label">LATEST</span><h2>Last 72 hours</h2></div><span>{fresh.length} items</span></div>
        <ArticleList articles={fresh} empty="No coverage in the last 72 hours." />
      </section>
      {older.length > 0 && (
        <section className="public-section older-coverage">
          <div className="section-heading"><div><span className="section-label">OLDER COVERAGE</span><h2>Previously published</h2></div><span>{older.length} items</span></div>
          <ArticleList articles={older} />
        </section>
      )}
    </main>
  );
}
