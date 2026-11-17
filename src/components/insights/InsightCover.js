// An insight's cover: a short muted looping video with a still poster, or just the still.
// Readers who ask for reduced motion get the still (CSS hides the video, see landing.css).
export function InsightCover({ cover, className, priority = false }) {
  return (
    <figure className={className ? `insight-cover-media ${className}` : "insight-cover-media"}>
      {cover.video ? (
        <video
          src={cover.video}
          poster={cover.image || undefined}
          autoPlay
          muted
          loop
          playsInline
          preload={priority ? "auto" : "metadata"}
          aria-label={cover.alt}
        />
      ) : null}
      {cover.image ? (
        <img
          className={cover.video ? "insight-cover-still" : undefined}
          src={cover.image}
          alt={cover.alt}
          width={800}
          height={800}
          loading={priority ? "eager" : "lazy"}
        />
      ) : null}
    </figure>
  );
}
