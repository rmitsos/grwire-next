# Changelog

## Unreleased

### Changed
- Articles are now deduplicated by a canonical URL (lowercase host, no `www.`, no tracking
  parameters, no `/amp` suffix) and by a Greek-accent- and inflection-tolerant title comparison, so
  the same story arriving via a tracked RSS link and a clean link, or with and without a trailing
  " - Sitename.com" credit, is stored once instead of twice.
- The homepage no longer repeats an article across the lead slot, "Latest" and the sector columns.
  Each article now has a single primary sector (its highest-scoring watch rule, with a fixed
  tie-break order) and only appears in that one column; section pages still list every match.
- The telecom rule no longer treats bare "interconnection"/"διασύνδεση" wording as a telecom
  signal, and now excludes electricity-grid context (ΑΔΜΗΕ, "ηλεκτρικ*", etc.). Electrical
  interconnection stories (e.g. the Greece–Italy cable) now classify as energy only, not telecom.
- The finance rule now requires a mention of a specific monitored company (banks and large-cap
  listed companies) instead of accepting any story that mentions "χρηματιστήριο" or "μέρισμα";
  small-cap dividend news and generic market commentary no longer qualify.
- Lifestyle, rental/residential-for-living, and ad-campaign stories are excluded from every watch
  rule, and infrastructure/finance can no longer reach their threshold from geography and
  preferred-source bonuses alone — a real topic or monitored-company match is required.
- Each source is now capped at 12 accepted items (configurable per source) before the overall daily
  cap is applied, so a single prolific source can no longer crowd out every other source.
- `eett-announcements` now reads the working ΕΕΤΤ press-release RSS feed (the old HTML page and
  site-wide feed were broken or test-data-only); `raaey-energy-announcements` now reads ΡΑΑΕΥ's
  WordPress API instead of an HTML page that returns HTTP 500; `ot-gr` now reads ot.gr's WordPress
  API with excerpts instead of its noisy general RSS feed. The redundant `ot-telecoms` HTML source
  is disabled (0 accepted articles; covered by the new `ot-gr` telecom category).

### Fixed
- Rows already stored in the database keep their old `?utm_source=...` canonical URLs until a
  follow-up migration recomputes them; only newly ingested articles use the cleaned-up URL.
- Homepage and section pages are now cached and rebuilt at most once an hour, or right after a
  scan, instead of querying the database on every visit. Lets the Neon database sleep when idle
  and cuts Vercel CPU. If the database fails during a rebuild, the last good page stays up instead
  of an empty one.
- Unknown section URLs (e.g. `/go`, `/redirect.php` from bots) return a static 404 without running
  a function.
- `robots.txt` keeps crawlers out of search result URLs; the sitemap now says "daily" instead of
  "always"/"hourly".
