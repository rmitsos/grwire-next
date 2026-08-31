import Link from "next/link";
import { ArticleList, dateLabel } from "@/components/ArticleList";
import { DailyStory } from "@/components/DailyStory";
import { getHomepageData, PUBLIC_CATEGORIES } from "@/public-data";

export const dynamic = "force-dynamic";

export default async function PublicHomepage() {
  const data = await getHomepageData();

  return (
    <main className="public-main">
      <section className="public-masthead">
        <div className="public-date">{new Intl.DateTimeFormat("en-GB", { dateStyle: "full", timeZone: "Europe/Athens" }).format(new Date())}</div>
        <h1>The Greek infrastructure wire.</h1>
        <p>Finance, telecommunications and energy—filtered for what changes markets, investment and delivery.</p>
      </section>

      <DailyStory story={data.story} />

      {data.lead ? (
        <section className="lead-story">
          <div>
            <span className="section-label">LEAD SIGNAL · {dateLabel(data.lead.publishedAt)}</span>
            <h2><a href={data.lead.url} target="_blank" rel="noreferrer">{data.lead.title}</a></h2>
            {data.lead.summary && <p>{data.lead.summary}</p>}
          </div>
          <div className="lead-score"><strong>{Math.round(data.lead.score)}</strong><span>relevance</span></div>
        </section>
      ) : (
        <section className="lead-story empty-lead">
          <div><span className="section-label">SYSTEM READY</span><h2>Your public wire is waiting for its first scan.</h2><p>Open Private Intelligence and select “Scan now” after the database is connected.</p></div>
        </section>
      )}

      <section className="public-section">
        <div className="section-heading"><div><span className="section-label">LATEST</span><h2>Across the market</h2></div><Link href="/search">Search the wire →</Link></div>
        <ArticleList articles={data.recent} />
      </section>

      <section className="category-grid">
        {Object.entries(PUBLIC_CATEGORIES).map(([slug, category]) => (
          <article className="category-column" key={slug}>
            <div className="section-heading"><div><span className="section-label">{slug}</span><h2>{category.name}</h2></div><Link href={`/${slug}`}>View all →</Link></div>
            <ArticleList articles={data.categories[slug]} empty={`No ${category.name.toLowerCase()} items yet.`} />
          </article>
        ))}
      </section>
    </main>
  );
}
