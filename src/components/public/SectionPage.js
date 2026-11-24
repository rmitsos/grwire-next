import Link from "next/link";
import { PublicShell } from "@/components/public/PublicShell";
import { WireList } from "@/components/public/WireList";
import { formatWireDate, getPublicCopy, sectionTitle } from "@/landing/public-copy";
import { LANDING_ROUTES, sectionPath } from "@/landing/routes";
import { extractTrendingEntities, getLatestArticles } from "@/public-data";
import { splitByFreshness } from "@/feed-rules";

export async function SectionPage({ lang, category }) {
  const copy = getPublicCopy(lang);
  const articles = await getLatestArticles({ category, limit: 100 });
  // sources-spec.md §3 max_age_hours.news: the top of the page shows only
  // the last 72h; older matching coverage still exists, just lower down.
  const { fresh, older } = splitByFreshness(articles);
  const trending = extractTrendingEntities(articles.slice(0, 40), { limit: 6 });
  const latestAt = articles[0]?.publishedAt || null;

  return (
    <PublicShell lang={lang} active={category} elHref={sectionPath("el", category)} enHref={sectionPath("en", category)}>
      <section className={`pub-hero ${category}`}>
        <div className="pub-hero-meta">
          <span className="pub-label">{copy.section.label}</span>
          {latestAt && <span className="pub-hero-updated">{copy.home.sectionLatest} {formatWireDate(latestAt, lang)}</span>}
        </div>
        <h1>{sectionTitle(category, lang)}</h1>
        <p>{copy.sectionDecks[category]}</p>
        {trending.length > 0 && (
          <div className="section-entity-strip">
            <span className="trending-label">{copy.home.trendingLabel}</span>
            <div className="trending-chips">
              {trending.map((entity) => (
                <Link
                  className="trending-chip"
                  href={`${LANDING_ROUTES[lang].search}?q=${encodeURIComponent(entity.name)}&category=${encodeURIComponent(category)}`}
                  key={entity.name}
                >
                  {entity.name}
                  <span className="trending-count">{entity.count}</span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </section>
      <section className="pub-section">
        <div className="pub-heading">
          <div><span className="pub-label">{copy.section.recentLabel}</span><h2>{copy.section.recentTitle}</h2></div>
          <span>{copy.section.items(fresh.length)}</span>
        </div>
        <WireList articles={fresh} lang={lang} showHeadline interactive filterable empty={articles.length ? copy.emptyRecent : copy.empty} />
      </section>
      {older.length > 0 && (
        <section className="pub-section">
          <div className="pub-heading">
            <div><span className="pub-label">{copy.section.olderLabel}</span><h2>{copy.section.olderTitle}</h2></div>
            <span>{copy.section.items(older.length)}</span>
          </div>
          <WireList articles={older} lang={lang} interactive />
        </section>
      )}
    </PublicShell>
  );
}
