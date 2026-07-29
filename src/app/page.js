import Link from "next/link";
import { getDashboardData } from "@/dashboard-data";
import { requirePrivateSession } from "@/session";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  await requirePrivateSession();
  const data = await getDashboardData();
  const statusCounts = Object.groupBy(data.relationships, (relationship) => relationship.status);

  return (
    <main className="dashboard">
      <header className="topbar">
        <div>
          <div className="eyebrow">GR WIRE / PRIVATE INTELLIGENCE</div>
          <h1>Market map</h1>
        </div>
        <div className="top-actions">
          <Link href="/relationships">Relationship register</Link>
          <form action="/api/logout" method="post"><button className="quiet" type="submit">Sign out</button></form>
        </div>
      </header>

      {data.preview && (
        <div className="preview-banner">
          <strong>Preview mode.</strong> These records are fictional. Connect Neon to display private market data.
        </div>
      )}
      {data.databaseError && <div className="warning-banner">The database could not be read; preview data is shown.</div>}

      <section className="metrics">
        <Metric label="Relevant articles" value={data.articles.length} note="Latest review set" />
        <Metric label="Organisations" value={data.organizations.length} note="Mapped entities" />
        <Metric label="Active claims" value={data.relationships.length} note="Facts + assessments" />
        <Metric label="Rumours" value={(statusCounts.rumour || []).length} note="Always private" />
      </section>

      <section className="dashboard-grid">
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
                <strong>{(statusCounts[status] || []).length}</strong>
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

function nameOf(organizations, id) {
  return organizations.find((organization) => organization.id === id)?.name || id;
}

function labelType(value) {
  return value.replaceAll("_", " ");
}
