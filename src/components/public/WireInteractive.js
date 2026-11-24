"use client";

import { useEffect, useMemo, useState } from "react";

const SAVED_KEY = "grwire:saved-urls:v1";

function readSavedSet() {
  try {
    const raw = window.localStorage.getItem(SAVED_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

function writeSavedSet(set) {
  try {
    window.localStorage.setItem(SAVED_KEY, JSON.stringify([...set].slice(-100)));
  } catch {
    // Ignore storage quota or private-mode errors
  }
}

export function WireInteractive({ items, labels, tierLabels, headlineLabel, viaGoogleNews, filterable = false, searchBaseHref }) {
  const [filter, setFilter] = useState("all");
  const [savedUrls, setSavedUrls] = useState(() => new Set());
  const [copiedUrl, setCopiedUrl] = useState(null);

  useEffect(() => {
    setSavedUrls(readSavedSet());
  }, []);

  const officialCount = useMemo(
    () => items.filter((item) => item.sourceTier === "official").length,
    [items],
  );

  const sectionOptions = useMemo(() => {
    const seen = new Map();
    for (const item of items) {
      for (const tag of item.categoryTags) {
        if (!seen.has(tag.slug)) seen.set(tag.slug, { ...tag, count: 0 });
        seen.get(tag.slug).count += 1;
      }
    }
    return [...seen.values()];
  }, [items]);

  const savedCount = useMemo(
    () => items.filter((item) => savedUrls.has(item.url)).length,
    [items, savedUrls],
  );

  const visibleItems = useMemo(() => {
    if (!filterable || filter === "all") return items;
    if (filter === "official") return items.filter((item) => item.sourceTier === "official");
    if (filter === "saved") return items.filter((item) => savedUrls.has(item.url));
    if (filter.startsWith("sec:")) {
      const slug = filter.slice(4);
      return items.filter((item) => item.categoryTags.some((tag) => tag.slug === slug));
    }
    return items;
  }, [items, filter, filterable, savedUrls]);

  function toggleSave(url) {
    setSavedUrls((prev) => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      writeSavedSet(next);
      return next;
    });
  }

  async function copyLink(url) {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedUrl(url);
      window.setTimeout(() => setCopiedUrl((current) => (current === url ? null : current)), 1800);
    } catch {
      // Ignore clipboard permission denials
    }
  }

  return (
    <>
      {filterable && items.length > 1 && (
        <div className="wire-filter-bar" role="toolbar" aria-label={labels.all}>
          <button
            type="button"
            className={`wire-filter-pill${filter === "all" ? " active" : ""}`}
            onClick={() => setFilter("all")}
          >
            {labels.all}
            <span className="wire-filter-count">{items.length}</span>
          </button>
          {officialCount > 0 && (
            <button
              type="button"
              className={`wire-filter-pill tier-official${filter === "official" ? " active" : ""}`}
              onClick={() => setFilter("official")}
            >
              <span className="tier-dot" aria-hidden="true" />
              {labels.officialOnly}
              <span className="wire-filter-count">{officialCount}</span>
            </button>
          )}
          {sectionOptions.length > 1 && sectionOptions.map((sec) => (
            <button
              type="button"
              key={sec.slug}
              className={`wire-filter-pill${filter === `sec:${sec.slug}` ? " active" : ""}`}
              style={{ "--tab": sec.color }}
              onClick={() => setFilter(`sec:${sec.slug}`)}
            >
              <span className="sec-mini-dot" aria-hidden="true" />
              {sec.label}
            </button>
          ))}
          {savedCount > 0 && (
            <button
              type="button"
              className={`wire-filter-pill${filter === "saved" ? " active" : ""}`}
              onClick={() => setFilter("saved")}
            >
              {labels.savedOnly}
              <span className="wire-filter-count">{savedCount}</span>
            </button>
          )}
        </div>
      )}

      {visibleItems.length === 0 ? (
        <div className="pub-empty wire-filter-empty">
          <p>{labels.noMatch}</p>
          <button type="button" className="wire-reset-btn" onClick={() => setFilter("all")}>
            {labels.resetFilter}
          </button>
        </div>
      ) : (
        <div className="wire-list">
          {visibleItems.map((article) => {
            const isSaved = savedUrls.has(article.url);
            const isCopied = copiedUrl === article.url;
            return (
              <article
                className={`wire-item${article.headline ? " is-headline" : ""}`}
                style={{ "--accent": article.accentColor }}
                key={article.key}
              >
                <div className="wire-time">{article.timeLabel}</div>
                <div className="wire-body">
                  <div className="wire-meta-row">
                    {article.headline && <span className="wire-headline">{headlineLabel}</span>}
                    {article.sourceName && (
                      <span className="wire-source" style={{ color: article.accentColor }}>
                        {article.sourceName}
                      </span>
                    )}
                    {article.sourceTier && tierLabels[article.sourceTier] && (
                      <span className={`tier-badge tier-${article.sourceTier}`}>
                        {tierLabels[article.sourceTier]}
                      </span>
                    )}
                  </div>
                  <h3>
                    <a href={article.url} target="_blank" rel="noreferrer">
                      {article.title}
                      <span className="ext-arrow" aria-hidden="true">↗</span>
                    </a>
                  </h3>
                  {article.viaGoogleNews && <p className="wire-via">{viaGoogleNews}</p>}
                  {article.summary && <p className="wire-summary">{article.summary}</p>}
                  <div className="wire-foot">
                    <div className="wire-tags">
                      {article.categoryTags.map((tag) => (
                        <span className="wire-tag-sec" style={{ "--tab": tag.color }} key={tag.slug}>
                          <i className="sec-mini-dot" aria-hidden="true" />
                          {tag.label}
                        </span>
                      ))}
                      {searchBaseHref && article.entities?.map((entity) => (
                        <a
                          className="wire-entity-chip"
                          href={`${searchBaseHref}?q=${encodeURIComponent(entity)}`}
                          key={entity}
                        >
                          {entity}
                        </a>
                      ))}
                    </div>
                    <div className="wire-actions">
                      <button
                        type="button"
                        className={`wire-action-btn${isSaved ? " active" : ""}`}
                        onClick={() => toggleSave(article.url)}
                        aria-pressed={isSaved}
                        title={isSaved ? labels.saved : labels.save}
                      >
                        <svg viewBox="0 0 16 16" width="13" height="13" fill={isSaved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                          <path d="M3.5 2.5h9v11.5L8 10.8 3.5 14V2.5z" />
                        </svg>
                        <span>{isSaved ? labels.saved : labels.save}</span>
                      </button>
                      <button
                        type="button"
                        className={`wire-action-btn${isCopied ? " active" : ""}`}
                        onClick={() => copyLink(article.url)}
                        title={isCopied ? labels.copied : labels.copyLink}
                      >
                        <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                          <path d="M6.5 9.5l3-3M5 7.5L3.6 8.9a2.5 2.5 0 0 0 3.5 3.5L8.5 11M11 8.5l1.4-1.4a2.5 2.5 0 1 0-3.5-3.5L7.5 5" />
                        </svg>
                        <span>{isCopied ? labels.copied : labels.copyLink}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
