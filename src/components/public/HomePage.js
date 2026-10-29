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
  // A column with nothing to show, even after the 7-day fill, is not drawn as an empty box: it is
  // listed in one line below the grid with a link to its section page. A section the nav holds
  // back (fewer than 3 items) is neither drawn nor linked.
  const columnSlugs = { filled: [], empty: [] };
  for (const slug of Object.keys(PUBLIC_CATEGORIES)) {
    if ((data.columns[slug] ?? []).length) columnSlugs.filled.push(slug);
    else if (navVisibility[slug]?.shown !== false) columnSlugs.empty.push(slug);
  }
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
        {columnSlugs.filled.map((slug) => (
          <article className="pub-column" key={slug}>
            <div className="pub-heading">
              <div><span className="pub-label">GR WIRE</span><h2>{sectionTitle(slug, lang)}</h2></div>
              {navVisibility[slug]?.shown !== false && <Link href={sectionPath(lang, slug)}>{copy.viewAll}</Link>}
            </div>
            <WireList articles={data.columns[slug]} lang={lang} />
          </article>
        ))}
      </section>

      {columnSlugs.empty.length > 0 && (
        <p className="pub-more-sections">
          <span className="pub-label">{copy.moreSections}</span>{" "}
          {columnSlugs.empty.map((slug, index) => (
            <span key={slug}>{index > 0 && " · "}<Link href={sectionPath(lang, slug)}>{sectionTitle(slug, lang)} →</Link></span>
          ))}
        </p>
      )}
    </PublicShell>
  );
}
