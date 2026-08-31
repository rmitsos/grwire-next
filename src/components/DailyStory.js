import Link from "next/link";

export function DailyStory({ story, archive = false }) {
  if (!story) {
    return (
      <section className="daily-story empty-story">
        <div><span className="section-label">DAILY MARKET STORY</span><h2>The first story will appear after a validated scan.</h2><p>Stories are generated from repeated signals, independent sources and linked evidence.</p></div>
        <Link className="story-search-button" href="/search">Search archive</Link>
      </section>
    );
  }

  return (
    <section className={`daily-story ${archive ? "archive-story" : ""}`}>
      <div className="story-heading">
        <div>
          <span className="section-label">DAILY MARKET STORY · {formatStoryDate(story.storyDate)}</span>
          <h2>{story.headline}</h2>
          {story.standfirst && <p className="story-standfirst">{story.standfirst}</p>}
        </div>
        <div className="story-confidence"><strong>{Math.round(story.confidence * 100)}%</strong><span>evidence confidence</span></div>
      </div>
      <div className="story-body">
        {(story.body || []).map((paragraph, index) => <p key={`${story.storyDate}-${index}`}>{paragraph}</p>)}
      </div>
      <div className="story-actions">
        {!archive && <Link className="story-search-button" href="/search">Search story archive</Link>}
        {archive && <Link className="story-search-button" href="/">Back to today</Link>}
        <span>{story.evidence?.length || 0} linked evidence items</span>
      </div>
      {story.evidence?.length > 0 && (
        <div className="story-evidence">
          <span className="section-label">EVIDENCE</span>
          {story.evidence.map((item) => (
            <a href={item.url} target="_blank" rel="noreferrer" key={`${item.id || item.url}`}>
              <strong>{item.title}</strong><small>{item.sourceId || "Source"}</small>
            </a>
          ))}
        </div>
      )}
    </section>
  );
}

function formatStoryDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "Europe/Athens" }).format(new Date(value));
}
