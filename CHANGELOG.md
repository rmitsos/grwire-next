# Changelog

## Unreleased

### Added
- Newsletter sign-up backend (Phase 3 of plan.md): a `subscribers` table with double opt-in, GDPR
  consent (timestamp, consent-text version, page and language recorded per signup), and a honeypot
  field against bot sign-ups. New `src/newsletter/` module: `store.js` (lazy, idempotent schema —
  not part of `ensureDatabase()`, so it isn't created by every ingest run), `tokens.js` (random
  tokens, stored only as sha256 hashes), `provider.js` (a minimal Resend client plus
  `assertTrackingDisabled()` to verify open/click tracking is off before any bulk send), `config.js`
  (`getNewsletterConfig()`; the feature is disabled with no DB or provider calls unless
  `RESEND_API_KEY`, `NEWSLETTER_FROM`, `NEWSLETTER_SITE_URL` and `DATABASE_URL` are all set), and
  `service.js` (subscribe/confirm/unsubscribe logic, List-Unsubscribe / List-Unsubscribe-Post
  headers per RFC 8058).
- New routes `POST /api/newsletter/subscribe` (JSON or form, 303 redirect for form posts), `GET
  /api/newsletter/confirm` (double opt-in confirmation link, 7-day expiry) and `GET`/`POST
  /api/newsletter/unsubscribe` (one-click unsubscribe; `GET` only redirects to a confirmation page,
  since mail scanners prefetch links and must never trigger an unsubscribe).

### Changed
- Articles are now deduplicated by a canonical URL (lowercase host, no `www.`, no tracking
  parameters, no `/amp` suffix) and by a Greek-accent- and inflection-tolerant title comparison, so
  the same story arriving via a tracked RSS link and a clean link, or with and without a trailing
  " - Sitename.com" credit, is stored once instead of twice. The stored/displayed link itself keeps
  the publisher's host as published (`www.` included or not, trailing slash as-is) and only
  lowercases the host and strips tracking params (`utm_*`, `mc_*`, `fbclid`, `gclid`, `ref`) and the
  fragment — only the dedupe *key* is the fully canonical, `www.`-stripped form.
- The homepage no longer repeats an article across the lead slot, "Latest" and the sector columns.
  Each article now has a single primary sector (its highest-scoring watch rule, with a fixed
  tie-break order) and only appears in that one column; section pages still list every match.
- The telecom rule no longer treats bare "interconnection"/"διασύνδεση" wording as a telecom
  signal, and now excludes electricity-grid context (ΑΔΜΗΕ, "ηλεκτρικ*", etc.). Electrical
  interconnection stories (e.g. the Greece–Italy cable) now classify as energy only, not telecom.
- Watch-rule keyword matching is now word-start aware, so short terms only match whole words (e.g.
  "ΟΤΕ"/"Nova"/"port" no longer fire inside "ποτέ"/"innovation"/"report"/"sports").
- The electricity-grid exclusions above now only apply when no fibre/telecom signal is also
  present, so "Grid Telecom" and "ΔΕΗ Fiber" stories riding ΑΔΜΗΕ/ΔΕΔΔΗΕ infrastructure still
  classify as telecom; the global rental/residential exclusion is narrower too, so FTTH/fibre
  coverage that mentions "κατοικίες" (households, not homes for rent/sale) no longer gets rejected.
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
- `raaey-energy-announcements` now pulls all five ΡΑΑΕΥ categories listed in sources-spec.md §2.1
  (δελτία τύπου, ανακοινώσεις, διαβουλεύσεις, αποφάσεις ηλεκτρισμού, αποφάσεις φυσικού αερίου)
  instead of three; the boilerplate licensing categories (16, 28, 112, 122) stay excluded.
- `energypress` is re-enabled as a plain RSS source reading `energypress.gr/rss` (its `/feed`
  endpoint 404s); the old wp-json-based `energypress-wordpress` source stays disabled.
- `intracom-telecom-press` (press URL redirects to a 404 page), `dnews-eett` (no article links in
  the static HTML, and its tag feed returns an HTML page instead of RSS) and
  `google-news-greek-telco` (the query now returns TV listings, not telecom news) are disabled.
- The spec's `telecom-fibre`, `energy-grids`, `infrastructure-works` and `deals-companies` section
  ids now redirect permanently to the existing `/telco`, `/energy`, `/infrastructure` and
  `/finance` routes respectively.

### Fixed
- `ot-gr`'s limit is lowered from 60 to 30: ot.gr's nginx/WAF returns HTTP 403 on WordPress REST
  requests with `per_page >= 40`.
- Rows already stored in the database keep their old `?utm_source=...` canonical URLs until a
  follow-up migration recomputes them; only newly ingested articles use the cleaned-up URL. The
  cleaned-up URL now keeps `www.` (existing rows already have it), so new and old rows for the
  same publisher no longer disagree on host.
- Homepage and section pages are now cached and rebuilt at most once an hour, or right after a
  scan, instead of querying the database on every visit. Lets the Neon database sleep when idle
  and cuts Vercel CPU. If the database fails during a rebuild, the last good page stays up instead
  of an empty one.
- Unknown section URLs (e.g. `/go`, `/redirect.php` from bots) return a static 404 without running
  a function.
- `robots.txt` keeps crawlers out of search result URLs; the sitemap now says "daily" instead of
  "always"/"hourly".
