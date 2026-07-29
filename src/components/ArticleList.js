export function ArticleList({ articles, empty = "No articles have been collected yet." }) {
  if (!articles.length) {
    return (
      <div className="public-empty">
        <strong>Collection is ready</strong>
        <p>{empty} Run the first scan from the private intelligence dashboard.</p>
      </div>
    );
  }

  return (
    <div className="wire-list">
      {articles.map((article) => (
        <article className="wire-item" key={article.id}>
          <div className="wire-time">{dateLabel(article.publishedAt)}</div>
          <div>
            <div className="wire-source">{article.sourceId || "Source"} · relevance {Math.round(article.score)}</div>
            <h2><a href={article.url} target="_blank" rel="noreferrer">{article.title}</a></h2>
            {article.summary && <p>{article.summary}</p>}
            <div className="wire-tags">
              {article.categories.map((category) => <span key={category}>{category}</span>)}
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

export function dateLabel(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Athens",
  }).format(new Date(value));
}
