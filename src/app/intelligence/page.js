import Link from "next/link";
import { getDashboardData } from "@/dashboard-data";
import { requirePrivateSession } from "@/session";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  await requirePrivateSession();
  const data = await getDashboardData();
  const statusCounts = data.relationships.reduce((counts, relationship) => {
    counts[relationship.status] = (counts[relationship.status] || 0) + 1;
    return counts;
  }, {});

  return (
    <main className="dashboard">
      <header className="topbar">
        <div>
          <div className="eyebrow">GR WIRE / PRIVATE INTELLIGENCE</div>
          <h1>Market map</h1>
        </div>
        <div className="top-actions">
          <Link href="/intelligence/relationships">Relationship register</Link>
          <form action="/api/ingest?return=intelligence" method="post"><button className="quiet" type="submit">Scan now</button></form>
          <form action="/api/logout" method="post"><button className="quiet" type="submit">Sign out</button></form>
        </div>
      </header>

      {data.preview && (
        <div className="preview-banner">
          <strong>Preview mode.</strong> These records are fictional. Connect Neon to display private market data.
        </div>
      )}
      {data.databaseError && <div className="warning-banner">The database could not be read; preview data is shown.</div>}

      <section className="panel intelligence-board">
        <div className="panel-heading">
          <div><span className="kicker">MARKET FORESIGHT</span><h2>Today’s intelligence</h2></div>
          <span className="muted">{data.intelligence.articleCount} signals · {data.intelligence.sourceCount} sources</span>
        </div>
        <div className="foresight-grid">
          {[...data.intelligence.trends, ...data.intelligence.correlations, ...data.intelligence.watch].slice(0, 8).map((item, index) => (
            <article className={`foresight-card ${item.type}`} key={`${item.type}-${item.title}-${index}`}>
              <div className="foresight-topline"><span>{labelInsightType(item.type)}</span><strong>{Math.round(item.confidence * 100)}%</strong></div>
              <h3>{item.title}</h3>
              <p>{item.summary}</p>
              {item.horizon && <small>Horizon: {item.horizon}</small>}
            </article>
          ))}
          {!data.intelligence.trends.length && !data.intelligence.correlations.length && <div className="empty">More validated signals are needed before trends can be identified.</div>}
        </div>
        <p className="panel-note">Predictions are evidence-based situations to monitor, not confirmed facts. Confidence reflects source diversity, repeated signals and relationship evidence.</p>
      </section>

      <section className="metrics">
        <Metric label="Stored articles" value={data.articles.length} note="Latest review set" />
        <Metric label="Last scan accepted" value={data.latestScan?.relevant ?? "—"} note={data.latestScan ? `${data.latestScan.fetched} discovered` : "Run the first scan"} />
        <Metric label="Organisations" value={data.organizations.length} note="Mapped entities" />
        <Metric label="Active claims" value={data.relationships.length} note="Facts + assessments" />
        <Metric label="Rumours" value={statusCounts.rumour || 0} note="Always private" />
        <Metric label="Source candidates" value={data.sourceCandidates.length} note="Awaiting review" />
      </section>

      <section className="dashboard-grid">
        {data.latestScan && (
          <div className="panel full">
            <div className="panel-heading">
              <div><span className="kicker">SOURCE HEALTH</span><h2>Latest market scan</h2></div>
              <span className="muted">{dateTimeLabel(data.latestScan.scannedAt)}</span>
            </div>
            <div className="source-grid">
              {data.latestScan.sources.map((source) => (
                <article className={`source-card ${source.ok ? "" : "failed"}`} key={source.id}>
                  <strong>{source.id}</strong>
                  {source.ok
                    ? <span>{source.accepted || 0} accepted · {source.fetched || 0} fetched</span>
                    : <span>Failed · {source.error}</span>}
                </article>
              ))}
            </div>
          </div>
        )}

        <div className="panel">
          <div className="panel-heading">
            <div><span className="kicker">SOURCE SCOUT</span><h2>New possible sources</h2></div>
            <span className="muted">Probationary</span>
          </div>
          <div className="status-list">
            {data.sourceCandidates.map((candidate) => (
              <div className="source-candidate" key={candidate.domain}>
                <a href={candidate.exampleUrl} target="_blank" rel="noreferrer"><strong>{candidate.domain}</strong></a>
                <span>{candidate.occurrences} sightings · {Math.round(candidate.score)} score</span>
              </div>
            ))}
            {!data.sourceCandidates.length && <div className="empty">No new source candidates yet.</div>}
          </div>
        </div>

        <div className="panel wide">
          <div className="panel-heading">
            <div><span className="kicker">NEWS SIGNALS</span><h2>Items requiring attention</h2></div>
            <span className="muted">Ranked by relevance</span>
          </div>
          <div className="article-list">
            {data.articles.map((article) => (
              <article className="article-row" key={article.id}>
                <div className="score">{Math.round(article.score)}</div>
                <div>
                  <div className="article-meta">{article.sourceId || "Unknown source"} · {dateLabel(article.publishedAt)}</div>
                  <h3>{article.url === "#" ? article.title : <a href={article.url} target="_blank" rel="noreferrer">{article.title}</a>}</h3>
                  {article.summary && <p>{article.summary}</p>}
                </div>
              </article>
            ))}
            {!data.articles.length && <Empty text="No relevant articles have been stored yet." />}
          </div>
        </div>

        <div className="panel">
          <div className="panel-heading">
            <div><span className="kicker">KNOWLEDGE QUALITY</span><h2>Claim status</h2></div>
          </div>
          <div className="status-list">
            {["confirmed", "reported", "assessment", "rumour", "disputed"].map((status) => (
              <div className="status-row" key={status}>
                <span className={`badge ${status}`}>{status}</span>
                <strong>{statusCounts[status] || 0}</strong>
              </div>
            ))}
          </div>
          <p className="panel-note">Assessments, rumours and professional notes remain private regardless of article visibility.</p>
        </div>

        <div className="panel full">
          <div className="panel-heading">
            <div><span className="kicker">POSSIBLE EXPOSURE</span><h2>Impact paths</h2></div>
            <span className="muted">Confidence decays at each relationship</span>
          </div>
          <div className="impact-grid">
            {data.impacts.map((impact, index) => (
              <article className="impact-card" key={`${impact.origin}-${impact.target}-${index}`}>
                <div className="impact-confidence">{Math.round(impact.confidence * 100)}%</div>
                <h3>{nameOf(data.organizations, impact.origin)} → {nameOf(data.organizations, impact.target)}</h3>
                <p>{impact.path.map((step) => labelType(step.type)).join(" · ")}</p>
                <span>{impact.depth} relationship{impact.depth > 1 ? "s" : ""}</span>
              </article>
            ))}
            {!data.impacts.length && <Empty text="Impact paths will appear as relationships are added." />}
          </div>
        </div>
      </section>
    </main>
  );
}

function Metric({ label, value, note }) {
  return <article className="metric"><span>{label}</span><strong>{value}</strong><small>{note}</small></article>;
}

function Empty({ text }) {
  return <div className="empty">{text}</div>;
}

function dateLabel(value) {
  if (!value) return "Undated";
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "Europe/Athens" }).format(new Date(value));
}

function dateTimeLabel(value) {
  if (!value) return "Not scanned";
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Athens",
  }).format(new Date(value));
}

function nameOf(organizations, id) {
  return organizations.find((organization) => organization.id === id)?.name || id;
}

function labelType(value) {
  return value.replaceAll("_", " ");
}

function labelInsightType(value) {
  return value === "watch" ? "Situation to watch" : value === "correlation" ? "Correlation" : "Emerging trend";
}
