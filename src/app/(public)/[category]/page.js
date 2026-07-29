import { notFound } from "next/navigation";
import { ArticleList } from "@/components/ArticleList";
import { getLatestArticles, PUBLIC_CATEGORIES } from "@/public-data";

export const dynamic = "force-dynamic";

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

  return (
    <main className="public-main">
      <section className={`category-hero ${category}`}>
        <span className="section-label">GR WIRE / {category}</span>
        <h1>{config.name}</h1>
        <p>{config.deck}</p>
      </section>
      <section className="public-section">
        <div className="section-heading"><div><span className="section-label">LATEST COVERAGE</span><h2>Newest first</h2></div><span>{articles.length} items</span></div>
        <ArticleList articles={articles} />
      </section>
    </main>
  );
}
