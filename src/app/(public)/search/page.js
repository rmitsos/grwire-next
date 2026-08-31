import { ArticleList } from "@/components/ArticleList";
import { DailyStory } from "@/components/DailyStory";
import { getLatestArticles, PUBLIC_CATEGORIES, searchStories } from "@/public-data";

export const dynamic = "force-dynamic";
export const metadata = { title: "Search" };

export default async function SearchPage({ searchParams }) {
  const params = await searchParams;
  const query = String(params?.q || "").trim().slice(0, 100);
  const category = PUBLIC_CATEGORIES[params?.category] ? params.category : undefined;
  const [articles, stories] = query
    ? await Promise.all([getLatestArticles({ query, category, limit: 100 }), searchStories({ query, limit: 50 })])
    : [[], []];

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
        <>
          {stories.length > 0 && (
            <section className="public-section story-results">
              <div className="section-heading"><div><span className="section-label">STORY ARCHIVE</span><h2>Previous daily stories</h2></div><span>{stories.length} found</span></div>
              {stories.map((story) => <DailyStory story={story} archive key={`${story.storyDate}-${story.headline}`} />)}
            </section>
          )}
        <section className="public-section">
          <div className="section-heading"><div><span className="section-label">RESULTS</span><h2>“{query}”</h2></div><span>{articles.length} found</span></div>
          <ArticleList articles={articles} empty="No matching articles were found." />
        </section>
        </>
      )}
    </main>
  );
}
