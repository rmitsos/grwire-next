import { PublicShell } from "@/components/public/PublicShell";
import { WireList } from "@/components/public/WireList";
import { DailyStory } from "@/components/DailyStory";
import { getPublicCopy, sectionTitle } from "@/landing/public-copy";
import { LANDING_ROUTES } from "@/landing/routes";
import { getLatestArticles, PUBLIC_CATEGORIES, searchStories } from "@/public-data";

export async function SearchPage({ lang, searchParams }) {
  const copy = getPublicCopy(lang);
  const params = await searchParams;
  const query = String(params?.q || "").trim().slice(0, 100);
  const category = PUBLIC_CATEGORIES[params?.category] ? params.category : undefined;
  const [articles, stories] = query
    ? await Promise.all([
      // Search is rendered per request, so a failed read shows no results rather than an error page.
      getLatestArticles({ query, category, limit: 100 }).catch(() => []),
      searchStories({ query, limit: 50 }),
    ])
    : [[], []];

  return (
    <PublicShell lang={lang} active="search" elHref={LANDING_ROUTES.el.search} enHref={LANDING_ROUTES.en.search}>
      <section className="pub-hero">
        <span className="pub-label">{copy.search.label}</span>
        <h1>{copy.search.title}</h1>
        <form className="search-form" action={LANDING_ROUTES[lang].search} method="get">
          <input name="q" defaultValue={query} placeholder={copy.search.placeholder} />
          <select name="category" defaultValue={category || ""}>
            <option value="">{copy.search.allSections}</option>
            {Object.keys(PUBLIC_CATEGORIES).map((slug) => <option value={slug} key={slug}>{sectionTitle(slug, lang)}</option>)}
          </select>
          <button type="submit">{copy.search.button}</button>
        </form>
      </section>
      {query && (
        <>
          {stories.length > 0 && (
            <section className="pub-section">
              <div className="pub-heading">
                <div><span className="pub-label">{copy.search.storiesLabel}</span><h2>{copy.search.storiesTitle}</h2></div>
                <span>{copy.search.found(stories.length)}</span>
              </div>
              {stories.map((story) => <DailyStory story={story} lang={lang} key={`${story.storyDate}-${story.headline}`} />)}
            </section>
          )}
          <section className="pub-section">
            <div className="pub-heading">
              <div><span className="pub-label">{copy.search.resultsLabel}</span><h2>“{query}”</h2></div>
              <span>{copy.search.found(articles.length)}</span>
            </div>
            <WireList articles={articles} lang={lang} empty={copy.emptySearch} />
          </section>
        </>
      )}
    </PublicShell>
  );
}
