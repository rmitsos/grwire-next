import { formatWireDate, getPublicCopy, sectionTitle } from "@/landing/public-copy";

// One list of stories. Public fields only: time, publisher name, title (link to the original),
// summary and section tags. Never a ranking number or an internal source id; an empty list gets
// a neutral message, not an operator hint.
export function WireList({ articles, lang, empty, showHeadline = false }) {
  const copy = getPublicCopy(lang);
  if (!articles.length) {
    return (
      <div className="pub-empty">
        <p>{empty ?? copy.empty}</p>
      </div>
    );
  }

  return (
    <div className="wire-list">
      {articles.map((article) => (
        <article className="wire-item" key={article.id ?? article.url}>
          <div className="wire-time">{formatWireDate(article.publishedAt, lang)}</div>
          <div>
            {showHeadline && article.headline && <div className="wire-headline">{copy.headlineLabel}</div>}
            {article.sourceName && <div className="wire-source">{article.sourceName}</div>}
            <h3><a href={article.url} target="_blank" rel="noreferrer">{article.title}</a></h3>
            {article.viaGoogleNews && <p className="wire-via">{copy.viaGoogleNews}</p>}
            {article.summary && <p>{article.summary}</p>}
            <div className="wire-tags">
              {article.categories.map((category) => <span key={category}>{sectionTitle(category, lang)}</span>)}
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
