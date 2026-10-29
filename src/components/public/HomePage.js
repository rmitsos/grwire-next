import Link from "next/link";
import { PublicShell } from "@/components/public/PublicShell";
import { WireList } from "@/components/public/WireList";
import { formatMastheadDate, formatWireDate, getPublicCopy, sectionTitle } from "@/landing/public-copy";
import { LANDING_ROUTES, sectionPath } from "@/landing/routes";
import { getHomepageData, getNavVisibility, PUBLIC_CATEGORIES } from "@/public-data";
import { getInsight, insightPath, insightsIndexPath } from "@/insights/content";
import { getInsightsCopy } from "@/insights/copy";

// Homepage for one language. EL and EN share this component, so they cannot drift apart.
export async function HomePage({ lang }) {
  const copy = getPublicCopy(lang);
  const [data, navVisibility] = await Promise.all([getHomepageData(), getNavVisibility()]);
  // Reads a markdown file, not the DB, so it still renders when the DB is empty/unavailable.
  const insight = getInsight("fibre-switch", lang);
  // Columns take the best of each section first, so on a thin day "recent" can be empty while the
  // columns are full; an empty "Latest" block next to filled columns would only look broken.
  const hasColumnItems = Object.values(data.columns ?? {}).some((list) => list.length);
  const showLatest = data.recent.length > 0 || !hasColumnItems;

  return (
    <PublicShell lang={lang} elHref={LANDING_ROUTES.el.home} enHref={LANDING_ROUTES.en.home}>
      <section className="pub-masthead">
        <div className="pub-date">{formatMastheadDate(new Date(), lang)}</div>
        <h1>{copy.masthead.title}</h1>
        <p>{copy.masthead.lead}</p>
      </section>

      {data.lead && (
        <section className="pub-lead">
          <span className="pub-label">{copy.leadLabel} · {formatWireDate(data.lead.publishedAt, lang)}</span>
          <h2><a href={data.lead.url} target="_blank" rel="noreferrer">{data.lead.title}</a></h2>
          {data.lead.sourceName && <div className="wire-source">{data.lead.sourceName}</div>}
          {data.lead.viaGoogleNews && <p className="wire-via">{copy.viaGoogleNews}</p>}
          {data.lead.summary && <p>{data.lead.summary}</p>}
        </section>
      )}

      {insight && (
        <section className="insight-promo">
          <span className="pub-label">{copy.insightLabel}</span>
          {insight.draft && <span className="insight-draft-label">{getInsightsCopy(lang).draftLabel}</span>}
          <h2>{insight.title}</h2>
          {insight.standfirst.map((line, index) => <p key={index}>{line}</p>)}
          <div className="insight-promo-links">
            <Link href={insightPath(insight.slug, lang)}>{copy.insightRead}</Link>
            <Link href={insightsIndexPath(lang)}>{copy.insightAll}</Link>
          </div>
        </section>
      )}

      {showLatest && (
        <section className="pub-section">
          <div className="pub-heading">
            <div><span className="pub-label">{copy.latestLabel}</span><h2>{copy.latestTitle}</h2></div>
            <Link href={LANDING_ROUTES[lang].search}>{copy.searchLink}</Link>
          </div>
          <WireList articles={data.recent} lang={lang} />
        </section>
      )}

      <section className="pub-grid">
        {Object.keys(PUBLIC_CATEGORIES).map((slug) => {
          const articles = data.columns[slug] ?? [];
          const hidden = navVisibility[slug]?.shown === false;
          // A section the nav hides (fewer than 3 items) is not advertised here either: no
          // empty column and no "view all" link to a page that is held back.
          if (hidden && !articles.length) return null;
          return (
            <article className="pub-column" key={slug}>
              <div className="pub-heading">
                <div><span className="pub-label">GR WIRE</span><h2>{sectionTitle(slug, lang)}</h2></div>
                {!hidden && <Link href={sectionPath(lang, slug)}>{copy.viewAll}</Link>}
              </div>
              <WireList articles={articles} lang={lang} />
            </article>
          );
        })}
      </section>
    </PublicShell>
  );
}
