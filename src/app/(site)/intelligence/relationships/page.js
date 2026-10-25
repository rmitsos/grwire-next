import Link from "next/link";
import { getDashboardData } from "@/dashboard-data";
import { requirePrivateSession } from "@/session";

export const dynamic = "force-dynamic";

export default async function RelationshipsPage() {
  await requirePrivateSession();
  const data = await getDashboardData();

  return (
    <main className="dashboard">
      <header className="topbar compact">
        <div>
          <Link className="back-link" href="/intelligence">← Market map</Link>
          <h1>Relationship register</h1>
        </div>
        <div className="privacy-pill">Private by default</div>
      </header>
      {data.preview && <div className="preview-banner"><strong>Preview mode.</strong> All organisations below are fictional.</div>}
      <section className="relationship-list">
        {data.relationships.map((relationship) => (
          <article className="relationship-card" key={relationship.id}>
            <div className="relationship-main">
              <div className="relationship-names">
                <strong>{nameOf(data.organizations, relationship.sourceOrganizationId)}</strong>
                <span>{relationship.type.replaceAll("_", " ")}</span>
                <strong>{nameOf(data.organizations, relationship.targetOrganizationId)}</strong>
              </div>
              {relationship.rationale && <p>{relationship.rationale}</p>}
              {relationship.impact && (
                <div className="impact-tags">
                  {(relationship.impact.areas || []).map((area) => <span key={area}>{area}</span>)}
                  <span>{relationship.impact.polarity}</span>
                  <span>{relationship.impact.lag}</span>
                </div>
              )}
            </div>
            <div className="relationship-quality">
              <span className={`badge ${relationship.status}`}>{relationship.status}</span>
              <strong>{Math.round(relationship.confidence * 100)}%</strong>
              <small>{relationship.visibility}</small>
            </div>
            <div className="evidence-list">
              {relationship.evidence.map((evidence, index) => (
                <div className="evidence" key={`${relationship.id}-${index}`}>
                  <span>{evidence.kind.replaceAll("_", " ")}</span>
                  <p>{evidence.note || evidence.quote || "Linked evidence"}</p>
                  {evidence.url && <a href={evidence.url} target="_blank" rel="noreferrer">Open source ↗</a>}
                  <small>{evidence.author || evidence.sourceId || "Source"} · {dateLabel(evidence.observedAt)}</small>
                </div>
              ))}
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}

function nameOf(organizations, id) {
  return organizations.find((organization) => organization.id === id)?.name || id;
}

function dateLabel(value) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "Europe/Athens" }).format(new Date(value));
}
