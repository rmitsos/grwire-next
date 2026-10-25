import { LandingHeader } from "@/components/landing/LandingHeader";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { LANDING_ROUTES } from "@/landing/routes";
import { getInsightsCopy } from "@/insights/copy";
import { insightPath, insightsIndexPath } from "@/insights/content";
import { Markdown, renderInlineNodes } from "@/components/insights/Markdown";

function formatDate(iso, lang) {
  if (!iso) return null;
  return new Intl.DateTimeFormat(lang === "en" ? "en-GB" : "el-GR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Europe/Athens",
  }).format(new Date(iso));
}

export function InsightArticlePage({ lang, insight }) {
  const copy = getInsightsCopy(lang);
  const dateLabel = formatDate(insight.date, lang);

  return (
    <>
      <LandingHeader
        lang={lang}
        elHref={insightPath(insight.slug, "el")}
        enHref={insightPath(insight.slug, "en")}
        subscribeHref={`${LANDING_ROUTES[lang].subscribe}#subscribe`}
      />
      <main>
        <article className="insight-article">
          <div className="wrap insight-article-wrap">
            <p className="insight-kicker">{renderInlineNodes(insight.kicker)}</p>
            <h1>{insight.title}</h1>
            {insight.standfirst.map((line, index) => (
              <p className="insight-standfirst" key={index}>
                {line}
              </p>
            ))}
            <p className="insight-meta">
              {[dateLabel, copy.minReadLabel(insight.readingMinutes)].filter(Boolean).join(" · ")}
            </p>

            <div className="insight-body">
              <Markdown blocks={insight.body} />

              {insight.chart && (
                <figure className="insight-chart">
                  <img src={insight.chart.src} alt={insight.chart.alt} width={1600} height={1000} />
                  <figcaption>{insight.chart.caption}</figcaption>
                </figure>
              )}
            </div>

            {insight.sourcesHeading && (
              <section className="insight-sources">
                <h2>{insight.sourcesHeading}</h2>
                <ol>
                  {insight.sources.map((source, index) => (
                    <li key={index}>
                      {source.url ? (
                        <a href={source.url} target="_blank" rel="noopener noreferrer">
                          {source.text}
                        </a>
                      ) : (
                        source.text
                      )}
                    </li>
                  ))}
                </ol>
                {insight.method && <p className="insight-method">{insight.method}</p>}
              </section>
            )}

            <a className="back-link insight-back-link" href={insightsIndexPath(lang)}>
              {copy.backToIndex}
            </a>
          </div>
        </article>
      </main>
      <LandingFooter lang={lang} />
    </>
  );
}
