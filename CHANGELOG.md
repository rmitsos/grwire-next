# Changelog

## Unreleased

### Changed
- Homepage and section pages are now cached and rebuilt at most once an hour, or right after a
  scan, instead of querying the database on every visit. Lets the Neon database sleep when idle
  and cuts Vercel CPU. If the database fails during a rebuild, the last good page stays up instead
  of an empty one.
- Unknown section URLs (e.g. `/go`, `/redirect.php` from bots) return a static 404 without running
  a function.
- `robots.txt` keeps crawlers out of search result URLs; the sitemap now says "daily" instead of
  "always"/"hourly".
