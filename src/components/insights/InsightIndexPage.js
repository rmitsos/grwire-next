import { LandingHeader } from "@/components/landing/LandingHeader";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { LANDING_ROUTES } from "@/landing/routes";
import { getInsightsCopy } from "@/insights/copy";
import { insightPath, insightsIndexPath } from "@/insights/content";
import { renderInlineNodes } from "@/components/insights/Markdown";

export function InsightIndexPage({ lang, insights }) {
  const copy = getInsightsCopy(lang);
  const [featured, ...rest] = insights;

  return (
    <>
      <LandingHeader
        lang={lang}
        elHref={insightsIndexPath("el")}
        enHref={insightsIndexPath("en")}
        subscribeHref={`${LANDING_ROUTES[lang].subscribe}#subscribe`}
      />
      <main>
        <section className="insight-index-head">
          <div className="wrap">
            <h1>{copy.indexHeading}</h1>
          </div>
        </section>
        <section className="insight-index-list">
          <div className="wrap">
            {featured && <InsightCard insight={featured} lang={lang} copy={copy} featured />}
            {rest.map((insight) => (
              <InsightCard insight={insight} lang={lang} copy={copy} key={insight.slug} />
            ))}
          </div>
        </section>
      </main>
      <LandingFooter lang={lang} />
    </>
  );
}

function InsightCard({ insight, lang, copy, featured = false }) {
  return (
    <article className={featured ? "insight-card insight-card-featured" : "insight-card"}>
      <p className="insight-kicker">{renderInlineNodes(insight.kicker)}</p>
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
    </article>
  );
}
