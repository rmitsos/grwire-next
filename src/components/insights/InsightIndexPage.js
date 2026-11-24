import { LandingHeader } from "@/components/landing/LandingHeader";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { LANDING_ROUTES } from "@/landing/routes";
import { getInsightsCopy } from "@/insights/copy";
import { getPublicCopy } from "@/landing/public-copy";
import { insightPath, insightsIndexPath } from "@/insights/content";
import { renderInlineNodes } from "@/components/insights/Markdown";
import { InsightCover } from "@/components/insights/InsightCover";

export function InsightIndexPage({ lang, insights }) {
  const copy = getInsightsCopy(lang);
  const publicCopy = getPublicCopy(lang);
  const [featured, ...rest] = insights;

  return (
    <>
      <LandingHeader
        lang={lang}
        active="insights"
        elHref={insightsIndexPath("el")}
        enHref={insightsIndexPath("en")}
        subscribeHref={`${LANDING_ROUTES[lang].subscribe}#subscribe`}
      />
      <main>
        <section className="insight-index-head">
          <div className="wrap">
            <span className="pub-label">{publicCopy.home.featuredInsightEyebrow}</span>
            <h1>{copy.indexHeading}</h1>
          </div>
        </section>
        <section className="insight-index-list">
          <div className="wrap insight-index-grid">
            {featured && <InsightCard insight={featured} lang={lang} copy={copy} publicCopy={publicCopy} featured />}
            {rest.map((insight) => (
              <InsightCard insight={insight} lang={lang} copy={copy} publicCopy={publicCopy} key={insight.slug} />
            ))}
          </div>
        </section>
      </main>
      <LandingFooter lang={lang} elHref={insightsIndexPath("el")} enHref={insightsIndexPath("en")} />
    </>
  );
}

function InsightCard({ insight, lang, copy, publicCopy, featured = false }) {
  const highlight = publicCopy.insightHighlights?.[insight.slug];
  const hasVisual = Boolean(insight.cover || insight.chart?.src);

  return (
    <article className={`insight-card${featured ? " insight-card-featured" : ""}${hasVisual ? " has-chart" : ""}`}>
      <div className="insight-card-copy">
        <div className="insight-card-topline">
          <p className="insight-kicker">
            {renderInlineNodes(insight.kicker)}
            {insight.draft && <span className="insight-draft-label">{copy.draftLabel}</span>}
          </p>
          <span className="home-insight-time">{copy.minReadLabel(insight.readingMinutes)}</span>
        </div>
        {highlight && (
          <div className={featured ? "spotlight-stat" : "mini-stat-pill"}>
            <strong>{highlight.stat}</strong>
            <span>{highlight.label}</span>
          </div>
        )}
        <h2>
          <a href={insightPath(insight.slug, lang)}>{insight.title}</a>
        </h2>
        {insight.standfirst.map((line, index) => (
          <p className="insight-standfirst" key={index}>
            {line}
          </p>
        ))}
        <a className="insight-read-more" href={insightPath(insight.slug, lang)}>
          {copy.readMore}
        </a>
      </div>
      {insight.cover ? (
        <a className="insight-card-media" href={insightPath(insight.slug, lang)} tabIndex={-1} aria-hidden="true">
          <InsightCover cover={insight.cover} priority={featured} />
        </a>
      ) : insight.chart?.src ? (
        <a className="insight-card-media" href={insightPath(insight.slug, lang)}>
          <img src={insight.chart.src} alt={insight.chart.alt} width={800} height={500} />
        </a>
      ) : null}
    </article>
  );
}
