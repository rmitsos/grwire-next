import { getPublicCopy } from "@/landing/public-copy";
import { LANDING_ROUTES } from "@/landing/routes";

// Public archive card for a past daily story (shown on /search and /en/search). No score
// badge and no internal source ids: evidence shows the publisher name and a clean link.
export function DailyStory({ story, lang = "el" }) {
  const copy = getPublicCopy(lang).story;
  if (!story) return null;

  return (
    <section className="daily-story">
      <div className="story-heading">
        <span className="pub-label">{copy.label} · {formatStoryDate(story.storyDate, lang)}</span>
        <h3>{story.headline}</h3>
        {story.standfirst && <p className="story-standfirst">{story.standfirst}</p>}
      </div>
      <div className="story-body">
        {(story.body || []).map((paragraph, index) => <p key={`${story.storyDate}-${index}`}>{paragraph}</p>)}
      </div>
      <div className="story-actions">
        <a className="story-back" href={LANDING_ROUTES[lang].home}>{copy.back}</a>
        <span>{copy.evidenceCount(story.evidence?.length || 0)}</span>
      </div>
      {story.evidence?.length > 0 && (
        <div className="story-evidence">
          <span className="pub-label">{copy.evidenceLabel}</span>
          {story.evidence.map((item) => (
            <a href={item.url} target="_blank" rel="noreferrer" key={`${item.id || item.url}`}>
              <strong>{item.title}</strong>
              {item.sourceName && <small>{item.sourceName}</small>}
            </a>
          ))}
        </div>
      )}
    </section>
  );
}

function formatStoryDate(value, lang) {
  if (!value) return "";
  return new Intl.DateTimeFormat(getPublicCopy(lang).dateLocale, { dateStyle: "medium", timeZone: "Europe/Athens" }).format(new Date(value));
}
