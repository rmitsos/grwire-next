import { ArticleList } from "@/components/ArticleList";
import { getLatestArticles, PUBLIC_CATEGORIES } from "@/public-data";

export const dynamic = "force-dynamic";
export const metadata = { title: "Search" };

export default async function SearchPage({ searchParams }) {
  const params = await searchParams;
  const query = String(params?.q || "").trim().slice(0, 100);
  const category = PUBLIC_CATEGORIES[params?.category] ? params.category : undefined;
  const articles = query ? await getLatestArticles({ query, category, limit: 100 }) : [];

  return (
    <main className="public-main">
      <section className="search-hero">
        <span className="section-label">ARCHIVE</span>
        <h1>Search the wire</h1>
        <form className="search-form">
          <input name="q" defaultValue={query} placeholder="Company, project or market theme" />
          <select name="category" defaultValue={category || ""}>
            <option value="">All sections</option>
            {Object.entries(PUBLIC_CATEGORIES).map(([slug, config]) => <option value={slug} key={slug}>{config.name}</option>)}
          </select>
          <button type="submit">Search</button>
        </form>
      </section>
      {query && (
        <section className="public-section">
          <div className="section-heading"><div><span className="section-label">RESULTS</span><h2>“{query}”</h2></div><span>{articles.length} found</span></div>
          <ArticleList articles={articles} empty="No matching articles were found." />
        </section>
      )}
    </main>
  );
}
