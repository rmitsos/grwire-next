import { formatWireDate, getPublicCopy, sectionTitle } from "@/landing/public-copy";
import { NAV_SECTIONS } from "@/landing/copy";
import { LANDING_ROUTES } from "@/landing/routes";
import { WireInteractive } from "@/components/public/WireInteractive";

const COLOR_BY_SECTION = Object.fromEntries(NAV_SECTIONS.map((sec) => [sec.slug, sec.color]));

// One list of stories. Public fields only: time, publisher name, tier label, title (link to the
// original), summary, entities and section tags. Never a ranking number or an internal id; an
// empty list gets a neutral message, not an operator hint.
export function WireList({ articles, lang, empty, showHeadline = false, interactive = false, filterable = false }) {
  const copy = getPublicCopy(lang);
  if (!articles.length) {
    return (
      <div className="pub-empty">
        <p>{empty ?? copy.empty}</p>
      </div>
    );
  }

  if (interactive || filterable) {
    const publicItems = articles.map((article) => {
      const primary = article.categories?.[0];
      return {
        key: String(article.id ?? article.url),
        url: article.url,
        title: article.title,
        summary: article.summary || null,
        timeLabel: formatWireDate(article.publishedAt, lang),
        sourceName: article.sourceName || null,
        sourceTier: article.sourceTier || null,
        viaGoogleNews: Boolean(article.viaGoogleNews),
        headline: Boolean(showHeadline && article.headline),
        accentColor: COLOR_BY_SECTION[primary] || "var(--sec-telecom-fibre)",
        entities: article.entities || [],
        categoryTags: (article.categories || []).map((category) => ({
          slug: category,
          label: sectionTitle(category, lang),
          color: COLOR_BY_SECTION[category] || "var(--sec-telecom-fibre)",
        })),
      };
    });
    return (
      <WireInteractive
        items={publicItems}
        labels={copy.wireUi}
        tierLabels={copy.tiers}
        headlineLabel={copy.headlineLabel}
        viaGoogleNews={copy.viaGoogleNews}
        filterable={filterable}
        searchBaseHref={LANDING_ROUTES[lang].search}
      />
    );
  }

  return (
    <div className="wire-list">
      {articles.map((article) => {
        const primary = article.categories?.[0];
        const accentColor = COLOR_BY_SECTION[primary] || "var(--sec-telecom-fibre)";
        return (
          <article className="wire-item" style={{ "--accent": accentColor }} key={article.id ?? article.url}>
            <div className="wire-time">{formatWireDate(article.publishedAt, lang)}</div>
            <div className="wire-body">
              <div className="wire-meta-row">
                {showHeadline && article.headline && <span className="wire-headline">{copy.headlineLabel}</span>}
                {article.sourceName && <span className="wire-source" style={{ color: accentColor }}>{article.sourceName}</span>}
                {article.sourceTier && copy.tiers[article.sourceTier] && (
                  <span className={`tier-badge tier-${article.sourceTier}`}>{copy.tiers[article.sourceTier]}</span>
                )}
              </div>
              <h3>
                <a href={article.url} target="_blank" rel="noreferrer">
                  {article.title}
                  <span className="ext-arrow" aria-hidden="true">↗</span>
                </a>
              </h3>
              {article.viaGoogleNews && <p className="wire-via">{copy.viaGoogleNews}</p>}
              {article.summary && <p>{article.summary}</p>}
              <div className="wire-tags">
                {article.categories.map((category) => (
                  <span className="wire-tag-sec" style={{ "--tab": COLOR_BY_SECTION[category] || accentColor }} key={category}>
                    <i className="sec-mini-dot" aria-hidden="true" />
                    {sectionTitle(category, lang)}
                  </span>
                ))}
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
