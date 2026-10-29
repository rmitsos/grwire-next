import { getLandingCopy } from "@/landing/copy";
import { LANDING_ROUTES } from "@/landing/routes";
import { SimpleHeader } from "@/components/landing/SimpleHeader";
import { getUnsubscribeState, unsubscribeView } from "@/newsletter/page-state";

export async function UnsubscribeView({ lang, searchParams }) {
  const params = await searchParams;
  const token = typeof params?.token === "string" ? params.token : "";
  const status = typeof params?.status === "string" ? params.status : null;
  const copy = getLandingCopy(lang);
  const unsub = copy.unsubscribe;
  const state = !status && token ? await getUnsubscribeState(token) : null;
  const view = unsubscribeView({ state, status, hasToken: Boolean(token) });
  const message = view.statusKey ? copy.statusMessages[view.statusKey] : null;

  return (
    <>
      <SimpleHeader lang={lang} routeKey="unsubscribe" />
      <main className="wrap simple-page">
        <h1>{unsub.title}</h1>
        {message && <p className={`status-banner ${message.tone}`}>{message.text}</p>}
        {view.showButton && (
          <>
            <p>{unsub.intro}</p>
            <form action={`/api/newsletter/unsubscribe?token=${encodeURIComponent(token)}`} method="post">
              <input type="hidden" name="lang" value={lang} />
              <button className="btn" type="submit">
                {unsub.button}
              </button>
            </form>
          </>
        )}
        {view.missing && <p>{unsub.missingToken}</p>}
        <a className="back-link" href={LANDING_ROUTES[lang].subscribe}>
          {unsub.backLink}
        </a>
      </main>
    </>
  );
}
