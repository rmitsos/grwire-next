import { PublicShell } from "@/components/public/PublicShell";
import { WireList } from "@/components/public/WireList";
import { getPublicCopy, sectionTitle } from "@/landing/public-copy";
import { sectionPath } from "@/landing/routes";
import { getLatestArticles } from "@/public-data";
import { splitByFreshness } from "@/feed-rules";

export async function SectionPage({ lang, category }) {
  const copy = getPublicCopy(lang);
  const articles = await getLatestArticles({ category, limit: 100 });
  // sources-spec.md §3 max_age_hours.news: the top of the page shows only
  // the last 72h; older matching coverage still exists, just lower down.
  const { fresh, older } = splitByFreshness(articles);

  return (
    <PublicShell lang={lang} elHref={sectionPath("el", category)} enHref={sectionPath("en", category)}>
      <section className={`pub-hero ${category}`}>
        <span className="pub-label">{copy.section.label}</span>
        <h1>{sectionTitle(category, lang)}</h1>
        <p>{copy.sectionDecks[category]}</p>
      </section>
      <section className="pub-section">
        <div className="pub-heading">
          <div><span className="pub-label">{copy.section.recentLabel}</span><h2>{copy.section.recentTitle}</h2></div>
          <span>{copy.section.items(fresh.length)}</span>
        </div>
        <WireList articles={fresh} lang={lang} empty={articles.length ? copy.emptyRecent : copy.empty} />
      </section>
      {older.length > 0 && (
        <section className="pub-section">
          <div className="pub-heading">
            <div><span className="pub-label">{copy.section.olderLabel}</span><h2>{copy.section.olderTitle}</h2></div>
            <span>{copy.section.items(older.length)}</span>
          </div>
          <WireList articles={older} lang={lang} />
        </section>
      )}
    </PublicShell>
  );
}
