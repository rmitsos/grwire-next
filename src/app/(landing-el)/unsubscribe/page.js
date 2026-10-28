import { getLandingCopy } from "@/landing/copy";
import { buildLandingMetadata } from "@/landing/metadata";
import { SimpleHeader } from "@/components/landing/SimpleHeader";

export const metadata = buildLandingMetadata({
  lang: "el",
  routeKey: "unsubscribe",
  title: "GR Wire — Διαγραφή",
  description: "Διαγραφή από το εβδομαδιαίο email του GR Wire.",
  noindex: true,
});

export default async function Page({ searchParams }) {
  const params = await searchParams;
  const token = typeof params?.token === "string" ? params.token : "";
  const status = typeof params?.status === "string" ? params.status : null;
  const copy = getLandingCopy("el");
  const message = status ? copy.statusMessages[status] : null;
  const unsub = copy.unsubscribe;

  return (
    <>
      <SimpleHeader lang="el" routeKey="unsubscribe" />
      <main className="wrap simple-page">
        <h1>{unsub.title}</h1>
        {message && <p className={`status-banner ${message.tone}`}>{message.text}</p>}
        {token ? (
          <>
            <p>{unsub.intro}</p>
            <form action={`/api/newsletter/unsubscribe?token=${encodeURIComponent(token)}`} method="post">
              <input type="hidden" name="lang" value="el" />
              <button className="btn" type="submit">
                {unsub.button}
              </button>
            </form>
          </>
        ) : (
          !message && <p>{unsub.missingToken}</p>
        )}
        <a className="back-link" href="/subscribe">
          {unsub.backLink}
        </a>
      </main>
    </>
  );
}
