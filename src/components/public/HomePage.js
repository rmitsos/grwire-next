import Link from "next/link";
import { PublicShell } from "@/components/public/PublicShell";
import { SubscribeForm } from "@/components/landing/SubscribeForm";
import { TRUST_ICONS } from "@/components/landing/icons";
import { WireList } from "@/components/public/WireList";
import { formatMastheadDate, formatWireDate, getPublicCopy, sectionTitle } from "@/landing/public-copy";
import { LANDING_COPY, NAV_SECTIONS } from "@/landing/copy";
import { LANDING_ROUTES, sectionPath } from "@/landing/routes";
import { extractTrendingEntities, getHomepageData, getNavVisibility, PUBLIC_CATEGORIES } from "@/public-data";
import { INSIGHT_ORDER, getInsight, insightPath, insightsIndexPath, listInsights } from "@/insights/content";
import { getInsightsCopy } from "@/insights/copy";
import { InsightCover } from "@/components/insights/InsightCover";
import { getNewsletterConfig } from "@/newsletter/config";

const COLOR_BY_SECTION = Object.fromEntries(NAV_SECTIONS.map((sec) => [sec.slug, sec.color]));

// The lower half of the homepage is built only from what already exists: the section pages (with
// the number of stories each lists), the Insights, the "how we work" principles and the newsletter.
// It adds no stories, so the once-per-story rule and the Round 6 floors for the wire itself are
// untouched. The newsletter form is replaced by the "opens soon" note until sign-up is configured,
// exactly as on /subscribe.

// Homepage for one language. EL and EN share this component, so they cannot drift apart.
export async function HomePage({ lang }) {
  const copy = getPublicCopy(lang);
  const insightsCopy = getInsightsCopy(lang);
  const [data, navVisibility] = await Promise.all([getHomepageData(), getNavVisibility()]);
  // Reads a markdown file, not the DB, so it still renders when the DB is empty/unavailable.
  // The promo is the newest insight: the first slug in INSIGHT_ORDER.
  const insight = getInsight(INSIGHT_ORDER[0], lang);
  // Columns take the best of each section first, so on a thin day "recent" can be empty while the
  // columns are full; an empty "Latest" block next to filled columns would only look broken.
  const hasColumnItems = Object.values(data.columns ?? {}).some((list) => list.length);
  // A column with nothing to show, even after the 7-day fill, is not drawn as an empty box: it is
  // listed in one line below the grid with a link to its section page. A section the nav holds
  // back (fewer than 3 items) is neither drawn nor linked.
  const columnSlugs = { filled: [] };
  for (const slug of Object.keys(PUBLIC_CATEGORIES)) {
    // Tenders live under /tenders in the navigation menu, not as a homepage news column.
    if (slug !== "tenders" && (data.columns[slug] ?? []).length) columnSlugs.filled.push(slug);
  }
  // One tile per section the nav shows, in nav order. A held-back section gets no tile and no link.
  const tiles = NAV_SECTIONS.filter((section) => navVisibility[section.slug]?.shown !== false);
  const moreInsights = listInsights(lang).filter((item) => item.slug !== insight?.slug);
  const landing = LANDING_COPY[lang];
  const signupOpen = getNewsletterConfig().enabled;
  // Promote up to 4 recent stories into the left column below the Lead Story so the two-column
  // hero stays visually balanced alongside the Featured Insight Spotlight (once-per-story intact).
  const frontBriefs = data.lead && insight ? (data.recent ?? []).slice(0, 4) : [];
  const remainingRecent = (data.recent ?? []).slice(frontBriefs.length);
  const showLatest = remainingRecent.length > 0 || !hasColumnItems;
  const activeFrontDesks = tiles.filter(
    (section) => section.slug !== "tenders" && (data.sectionSummary?.[section.slug]?.count || 0) > 0,
  );

  // Front-page telemetry & trending entities derived purely from the homepage's already-placed stories.
  const placedStories = [
    data.lead,
    ...(data.recent ?? []),
    ...columnSlugs.filled.flatMap((slug) => data.columns[slug] ?? []),
  ].filter(Boolean);
  const trendingEntities = extractTrendingEntities(placedStories, { limit: 7 });
  const totalSectionStories = tiles.reduce((sum, sec) => sum + (data.sectionSummary?.[sec.slug]?.count || 0), 0);

  const leadPrimary = data.lead?.categories?.[0];
  const leadAccent = COLOR_BY_SECTION[leadPrimary] || "var(--signal)";
  const featuredHighlight = insight ? copy.insightHighlights?.[insight.slug] : null;

  return (
    <PublicShell lang={lang} home elHref={LANDING_ROUTES.el.home} enHref={LANDING_ROUTES.en.home}>
      <section className="pub-masthead pub-masthead-modern">
        <div className="pub-masthead-main">
          <div className="pub-date-row">
            <span className="live-dot" aria-hidden="true" />
            <span className="pub-date">{formatMastheadDate(new Date(), lang)}</span>
          </div>
          <h1>{copy.masthead.title}</h1>
          <p>{copy.masthead.lead}</p>
        </div>
        <aside className="pub-pulse-box" aria-label={copy.home.pulseLabel}>
          <div className="pub-pulse-head">
            <span className="pub-label">{copy.home.pulseLabel}</span>
          </div>
          <div className="pub-pulse-stats">
            {totalSectionStories > 0 && (
              <div className="pulse-stat">
                <strong>{totalSectionStories}</strong>
                <span>{copy.home.pulseStories(totalSectionStories)}</span>
              </div>
            )}
            <div className="pulse-stat">
              <strong>{tiles.length}</strong>
              <span>{copy.home.pulseSections(tiles.length)}</span>
            </div>
          </div>
          <form className="pulse-search" action={LANDING_ROUTES[lang].search} method="get">
            <input name="q" type="search" placeholder={copy.home.quickSearchPlaceholder} aria-label={copy.search.title} />
            <button type="submit" aria-label={copy.search.button}>→</button>
          </form>
        </aside>
      </section>

      {trendingEntities.length > 0 && (
        <nav className="trending-strip" aria-label={copy.home.trendingLabel}>
          <span className="trending-label">{copy.home.trendingLabel}</span>
          <div className="trending-chips">
            {trendingEntities.map((entity) => (
              <Link
                className="trending-chip"
                href={`${LANDING_ROUTES[lang].search}?q=${encodeURIComponent(entity.name)}`}
                key={entity.name}
              >
                {entity.name}
                <span className="trending-count">{entity.count}</span>
              </Link>
            ))}
          </div>
        </nav>
      )}

      {(data.lead || insight) && (
        <section className={`pub-front-grid${data.lead && insight ? "" : " single"}`}>
          {data.lead && (
            <div className="pub-front-left">
              <article className="pub-lead pub-lead-card" style={{ "--accent": leadAccent }}>
                <div className="pub-lead-top">
                  <span className="pub-label">{copy.leadLabel}</span>
                  <span className="pub-lead-sep" aria-hidden="true">·</span>
                  <span className="pub-lead-date">{formatWireDate(data.lead.publishedAt, lang)}</span>
                  {leadPrimary && (
                    <Link className="lead-section-pill" href={sectionPath(lang, leadPrimary)} style={{ "--tab": leadAccent }}>
                      <i className="sec-mini-dot" aria-hidden="true" />
                      {sectionTitle(leadPrimary, lang)}
                    </Link>
                  )}
                </div>
                <h2>
                  <a href={data.lead.url} target="_blank" rel="noreferrer">
                    {data.lead.title}
                    <span className="ext-arrow" aria-hidden="true">↗</span>
                  </a>
                </h2>
                <div className="wire-meta-row lead-meta-row">
                  {data.lead.sourceName && (
                    <span className="wire-source" style={{ color: leadAccent }}>{data.lead.sourceName}</span>
                  )}
                  {data.lead.sourceTier && copy.tiers[data.lead.sourceTier] && (
                    <span className={`tier-badge tier-${data.lead.sourceTier}`}>{copy.tiers[data.lead.sourceTier]}</span>
                  )}
                </div>
                {data.lead.viaGoogleNews && <p className="wire-via">{copy.viaGoogleNews}</p>}
                {data.lead.summary && <p className="pub-lead-summary">{data.lead.summary}</p>}
                {data.lead.entities?.length > 0 && (
                  <div className="lead-entities">
                    {data.lead.entities.map((entity) => (
                      <Link
                        className="wire-entity-chip"
                        href={`${LANDING_ROUTES[lang].search}?q=${encodeURIComponent(entity)}`}
                        key={entity}
                      >
                        {entity}
                      </Link>
                    ))}
                  </div>
                )}
              </article>

              {insight && frontBriefs.length > 0 && (
                <section className="pub-front-briefs" aria-label={copy.home.alsoOnWire}>
                  <div className="front-briefs-head">
                    <span className="pub-label">{copy.home.alsoOnWire}</span>
                    <Link href={LANDING_ROUTES[lang].search}>{copy.home.readMoreWire}</Link>
                  </div>
                  <ul className="front-brief-list">
                    {frontBriefs.map((article) => {
                      const primary = article.categories?.[0];
                      const accent = COLOR_BY_SECTION[primary] || "var(--sec-telecom-fibre)";
                      return (
                        <li className="front-brief-item" key={article.url}>
                          <div className="front-brief-meta">
                            {primary && (
                              <span className="front-brief-sec" style={{ "--tab": accent }}>
                                <i className="sec-mini-dot" aria-hidden="true" />
                                {sectionTitle(primary, lang)}
                              </span>
                            )}
                            {article.sourceName && <span className="front-brief-src">{article.sourceName}</span>}
                            {article.sourceTier && copy.tiers[article.sourceTier] && (
                              <span className={`tier-badge tier-${article.sourceTier}`}>{copy.tiers[article.sourceTier]}</span>
                            )}
                            <time className="front-brief-time" dateTime={article.publishedAt || undefined}>
                              {formatWireDate(article.publishedAt, lang)}
                            </time>
                          </div>
                          <h3>
                            <a href={article.url} target="_blank" rel="noreferrer">
                              {article.title}
                              <span className="ext-arrow" aria-hidden="true">↗</span>
                            </a>
                          </h3>
                        </li>
                      );
                    })}
                  </ul>
                  {frontBriefs.length < 3 && activeFrontDesks.length > 0 && (
                    <div className="front-brief-desks-bar">
                      {activeFrontDesks.map((section) => (
                        <Link
                          className="front-desk-pill"
                          href={sectionPath(lang, section.slug)}
                          style={{ "--tab": section.color }}
                          key={section.slug}
                        >
                          <i className="sec-mini-dot" aria-hidden="true" />
                          <span>{sectionTitle(section.slug, lang)}</span>
                          <strong>{data.sectionSummary[section.slug].count}</strong>
                        </Link>
                      ))}
                    </div>
                  )}
                </section>
              )}

              {insight && frontBriefs.length === 0 && activeFrontDesks.length > 0 && (
                <section className="pub-front-briefs pub-front-desks" aria-label={copy.home.desksLabel}>
                  <div className="front-briefs-head">
                    <span className="pub-label">{copy.home.desksLabel}</span>
                    <Link href={LANDING_ROUTES[lang].search}>{copy.home.readMoreWire}</Link>
                  </div>
                  <ul className="front-desk-list">
                    {activeFrontDesks.map((section) => {
                      const info = data.sectionSummary[section.slug];
                      return (
                        <li key={section.slug}>
                          <Link className="front-desk-row" href={sectionPath(lang, section.slug)} style={{ "--tab": section.color }}>
                            <span className="front-desk-body">
                              <span className="front-desk-main">
                                <i className="sec-mini-dot" aria-hidden="true" />
                                <strong>{sectionTitle(section.slug, lang)}</strong>
                                <span className="front-desk-latest">{formatWireDate(info.latestAt, lang)}</span>
                              </span>
                              {copy.sectionDecks?.[section.slug] && (
                                <span className="front-desk-deck">{copy.sectionDecks[section.slug]}</span>
                              )}
                            </span>
                            <span className="front-desk-count">{info.count}</span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              )}
            </div>
          )}

          {insight && (
            <aside className="insight-promo insight-spotlight">
              <div className="spotlight-top">
                <span className="pub-label">{copy.home.featuredInsightEyebrow}</span>
                {insight.draft && <span className="insight-draft-label">{insightsCopy.draftLabel}</span>}
                <span className="spotlight-readtime">{insightsCopy.minReadLabel(insight.readingMinutes)}</span>
              </div>
              {featuredHighlight && (
                <div className="spotlight-stat">
                  <strong>{featuredHighlight.stat}</strong>
                  <span>{featuredHighlight.label}</span>
                </div>
              )}
              <h2>
                <Link href={insightPath(insight.slug, lang)}>{insight.title}</Link>
              </h2>
              {insight.standfirst[0] && <p className="spotlight-deck">{insight.standfirst[0]}</p>}
              {insight.cover ? (
                <Link className="insight-promo-cover spotlight-cover-link" href={insightPath(insight.slug, lang)} tabIndex={-1} aria-hidden="true">
                  <InsightCover cover={insight.cover} priority />
                </Link>
              ) : insight.chart?.src ? (
                <Link className="spotlight-chart-link" href={insightPath(insight.slug, lang)}>
                  <figure className="spotlight-chart">
                    <img src={insight.chart.src} alt={insight.chart.alt} width={800} height={500} />
                  </figure>
                </Link>
              ) : null}
              <div className="insight-promo-links">
                <Link className="btn small" href={insightPath(insight.slug, lang)}>{copy.insightRead}</Link>
                <Link className="spotlight-all" href={insightsIndexPath(lang)}>{copy.insightAll}</Link>
              </div>
            </aside>
          )}
        </section>
      )}

      {showLatest && (
        <section className="pub-section">
          <div className="pub-heading">
            <div><span className="pub-label">{copy.latestLabel}</span><h2>{copy.latestTitle}</h2></div>
            <Link href={LANDING_ROUTES[lang].search}>{copy.searchLink}</Link>
          </div>
          <WireList articles={remainingRecent} lang={lang} interactive filterable />
        </section>
      )}

      <section className="pub-grid">
        {columnSlugs.filled.map((slug) => (
          <article className="pub-column" style={{ "--tab": COLOR_BY_SECTION[slug] || "var(--ink)" }} key={slug}>
            <div className="pub-heading">
              <div>
                <span className="pub-label column-label">
                  <i className="sec-mini-dot" aria-hidden="true" />
                  GR WIRE
                </span>
                <h2>{sectionTitle(slug, lang)}</h2>
              </div>
              {navVisibility[slug]?.shown !== false && <Link href={sectionPath(lang, slug)}>{copy.viewAll}</Link>}
            </div>
            <WireList articles={data.columns[slug]} lang={lang} />
          </article>
        ))}
      </section>

      <section className="pub-section home-sections">
        <div className="pub-heading">
          <div><span className="pub-label">{copy.home.sectionsLabel}</span><h2>{copy.home.sectionsTitle}</h2></div>
        </div>
        <div className="section-tiles" data-count={tiles.length}>
          {tiles.map((section) => {
            const info = data.sectionSummary?.[section.slug];
            return (
              <Link className="section-tile" href={sectionPath(lang, section.slug)} style={{ "--tab": section.color }} key={section.slug}>
                <div className="section-tile-head">
                  <h3>{sectionTitle(section.slug, lang)}</h3>
                  {info?.count > 0 && <span className="section-tile-badge">{info.count}</span>}
                </div>
                <p>{copy.sectionDecks[section.slug]}</p>
                <span className="section-tile-meta">
                  {info?.count > 0
                    ? <>{copy.section.items(info.count)} · {copy.home.sectionLatest} {formatWireDate(info.latestAt, lang)}</>
                    : copy.empty}
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      {moreInsights.length > 0 && (
        <section className="pub-section">
          <div className="pub-heading">
            <div><span className="pub-label">{copy.home.insightsLabel}</span><h2>{copy.home.insightsTitle}</h2></div>
            <Link href={insightsIndexPath(lang)}>{copy.insightAll}</Link>
          </div>
          <div className="home-insights">
            {moreInsights.map((item) => {
              const highlight = copy.insightHighlights?.[item.slug];
              return (
                <article className="home-insight" key={item.slug}>
                  <div className="home-insight-top">
                    {highlight && (
                      <div className="mini-stat-pill">
                        <strong>{highlight.stat}</strong>
                        <span>{highlight.label}</span>
                      </div>
                    )}
                    <span className="home-insight-time">{insightsCopy.minReadLabel(item.readingMinutes)}</span>
                  </div>
                  <h3><Link href={insightPath(item.slug, lang)}>{item.title}</Link></h3>
                  {item.standfirst[0] && <p>{item.standfirst[0]}</p>}
                  {item.chart?.src && (
                    <Link className="home-insight-chart-wrap" href={insightPath(item.slug, lang)}>
                      <img src={item.chart.src} alt={item.chart.alt} width={800} height={500} />
                    </Link>
                  )}
                  <Link className="insight-read-more" href={insightPath(item.slug, lang)}>{copy.insightRead}</Link>
                </article>
              );
            })}
          </div>
        </section>
      )}

      <section className="pub-section home-how">
        <div className="pub-heading">
          <div><span className="pub-label">GR WIRE</span><h2>{landing.howWeWork.title}</h2></div>
        </div>
        <div className="trust-grid">
          {landing.howWeWork.items.map((item, index) => {
            const Icon = TRUST_ICONS[index];
            return (
              <div className="trust-item" key={item.title}>
                <Icon />
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="home-signup" id="subscribe">
        <div>
          <span className="pub-label">{copy.home.signupLabel}</span>
          <h2>{landing.scopeLine}</h2>
          <p>{landing.hero.lead}</p>
        </div>
        {signupOpen
          ? <SubscribeForm lang={lang} sourcePage={LANDING_ROUTES[lang].home} idSuffix="home" />
          : <p className="signup-closed" role="status">{landing.hero.signupClosed}</p>}
      </section>
    </PublicShell>
  );
}
