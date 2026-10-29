import { Suspense } from "react";
import { getLandingCopy } from "@/landing/copy";
import { LANDING_ROUTES } from "@/landing/routes";
import { LandingHeader } from "@/components/landing/LandingHeader";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { SubscribeForm } from "@/components/landing/SubscribeForm";
import { StatusBanner } from "@/components/landing/StatusBanner";
import { TelecomIcon, TRUST_ICONS } from "@/components/landing/icons";
import { getLatestArticles } from "@/public-data";
import { getNewsletterConfig } from "@/newsletter/config";
import { insightPath } from "@/insights/content";

// Launch focus is telecom-fibre (landing-copy.md), so the sample cards show one latest article
// per section the spec calls out, not every public category.
const SAMPLE_SECTIONS = [
  { category: "telco", color: "var(--sec-telecom-fibre)" },
  { category: "energy", color: "var(--sec-energy-grids)" },
  { category: "infrastructure", color: "var(--sec-infrastructure-works)" },
];

async function getSampleArticles() {
  try {
    const results = await Promise.all(
      SAMPLE_SECTIONS.map(({ category }) => getLatestArticles({ category, limit: 1 })),
    );
    return SAMPLE_SECTIONS.map((section, index) => {
      const article = results[index][0];
      return article ? { ...section, article } : null;
    }).filter(Boolean);
  } catch (error) {
    // No DB, or a read failure: hide the whole section rather than fail the page build.
    console.error("[landing] sample articles read failed:", error?.message || error);
    return [];
  }
}

function formatSampleDate(iso) {
  if (!iso) return null;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Europe/Athens",
  }).format(new Date(iso));
}

export async function SubscribePage({ lang }) {
  const copy = getLandingCopy(lang);
  const sourcePage = LANDING_ROUTES[lang].subscribe;
  const samples = await getSampleArticles();
  // The sign-up API answers 503 "unavailable" until the newsletter env vars are set. Until then
  // the page says sign-up opens soon instead of showing a form that cannot work; the form comes
  // back by itself once the config is present (next revalidation, at most an hour).
  const signupOpen = getNewsletterConfig().enabled;
  const signupForm = (idSuffix) => signupOpen
    ? <SubscribeForm lang={lang} sourcePage={sourcePage} idSuffix={idSuffix} />
    : <p className="signup-closed" role="status">{copy.hero.signupClosed}</p>;

  return (
    <>
      <LandingHeader lang={lang} elHref={LANDING_ROUTES.el.subscribe} enHref={LANDING_ROUTES.en.subscribe} />
      <main>
        <section className="hero" id="subscribe">
          <div className="wrap">
            <div>
              <span className="chip" style={{ "--c": "var(--sec-telecom-fibre)" }}>
                <TelecomIcon />
                {copy.hero.chip}
              </span>
              <h1>
                {copy.hero.headlineMain}
                <br />
                <span className="soft">{copy.hero.headlineSoft}</span>
              </h1>
              <p className="lead">{copy.hero.lead}</p>
              <Suspense fallback={null}>
                <StatusBanner lang={lang} />
              </Suspense>
              {signupForm("hero")}
              <p className="from-li">
                {copy.hero.fromLinkedIn.before}
                <a href={insightPath("fibre-switch", lang)}>{copy.hero.fromLinkedIn.link}</a>
                {copy.hero.fromLinkedIn.after}
              </p>
            </div>
          </div>
        </section>

        <section className="block">
          <div className="wrap">
            <h2 style={{ marginBottom: 26 }}>{copy.whatYouGet.title}</h2>
            <div className="get-grid">
              {copy.whatYouGet.items.map((item) => (
                <div key={item.title}>
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {samples.length > 0 && (
          <section className="block" id="sample">
            <div className="wrap">
              <h2>{copy.samples.title}</h2>
              <p className="intro sample-note">{copy.samples.note}</p>
              <div className="sample-grid">
                {samples.map(({ category, color, article }) => (
                  <article className="sample-card" style={{ "--c": color }} key={category}>
                    <span className="badge-sample">{copy.samples.badge}</span>
                    <span className="chip" style={{ "--c": color }}>
                      {copy.header.navSections[category][lang]}
                    </span>
                    <p className="headline">
                      <a href={article.url} target="_blank" rel="noreferrer">
                        {article.title}
                      </a>
                    </p>
                    <div className="src">
                      {[article.sourceName, formatSampleDate(article.publishedAt)].filter(Boolean).join(" · ")}
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </section>
        )}

        <section className="block">
          <div className="wrap">
            <h2 style={{ marginBottom: 28 }}>{copy.howWeWork.title}</h2>
            <div className="trust-grid">
              {copy.howWeWork.items.map((item, index) => {
                const Icon = TRUST_ICONS[index];
                return (
                  <div className="trust-item" key={item.title}>
                    <Icon />
                    <h3>{item.title}</h3>
                    <p>{item.text}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="cta2">
          <div className="wrap">
            <div>
              <h2>{copy.cta2.title}</h2>
            </div>
            {signupForm("cta2")}
          </div>
        </section>
      </main>
      <LandingFooter lang={lang} elHref={LANDING_ROUTES.el.subscribe} enHref={LANDING_ROUTES.en.subscribe} />
    </>
  );
}
