import Link from "next/link";
import { PublicShell } from "@/components/public/PublicShell";
import { SubscribeForm } from "@/components/landing/SubscribeForm";
import { TRUST_ICONS } from "@/components/landing/icons";
import { WireList } from "@/components/public/WireList";
import { formatMastheadDate, formatWireDate, getPublicCopy, sectionTitle } from "@/landing/public-copy";
import { LANDING_COPY, NAV_SECTIONS } from "@/landing/copy";
import { LANDING_ROUTES, sectionPath } from "@/landing/routes";
import { getHomepageData, getNavVisibility, PUBLIC_CATEGORIES } from "@/public-data";
import { getInsight, insightPath, insightsIndexPath, listInsights } from "@/insights/content";
import { getInsightsCopy } from "@/insights/copy";
import { getNewsletterConfig } from "@/newsletter/config";

// The lower half of the homepage is built only from what already exists: the section pages (with
// the number of stories each lists), the Insights, the "how we work" principles and the newsletter.
// It adds no stories, so the once-per-story rule and the Round 6 floors for the wire itself are
// untouched. The newsletter form is replaced by the "opens soon" note until sign-up is configured,
// exactly as on /subscribe.

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
  const columnSlugs = { filled: [] };
  for (const slug of Object.keys(PUBLIC_CATEGORIES)) {
    if ((data.columns[slug] ?? []).length) columnSlugs.filled.push(slug);
  }
  // One tile per section the nav shows, in nav order. A held-back section gets no tile and no link.
  const tiles = NAV_SECTIONS.filter((section) => navVisibility[section.slug]?.shown !== false);
  const moreInsights = listInsights(lang).filter((item) => item.slug !== insight?.slug);
  const landing = LANDING_COPY[lang];
  const signupOpen = getNewsletterConfig().enabled;
  const showLatest = data.recent.length > 0 || !hasColumnItems;

  return (
    <PublicShell lang={lang} home elHref={LANDING_ROUTES.el.home} enHref={LANDING_ROUTES.en.home}>
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

      <section className="pub-section home-sections">
        <div className="pub-heading">
          <div><span className="pub-label">{copy.home.sectionsLabel}</span><h2>{copy.home.sectionsTitle}</h2></div>
        </div>
        <div className="section-tiles" data-count={tiles.length}>
          {tiles.map((section) => {
            const info = data.sectionSummary?.[section.slug];
            return (
              <Link className="section-tile" href={sectionPath(lang, section.slug)} style={{ "--tab": section.color }} key={section.slug}>
                <h3>{sectionTitle(section.slug, lang)}</h3>
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
            {moreInsights.map((item) => (
              <article className="home-insight" key={item.slug}>
                <h3><Link href={insightPath(item.slug, lang)}>{item.title}</Link></h3>
                {item.standfirst[0] && <p>{item.standfirst[0]}</p>}
                <Link className="insight-read-more" href={insightPath(item.slug, lang)}>{copy.insightRead}</Link>
              </article>
            ))}
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
