# Changelog

## Unreleased

### Changed
- Public wire cleanup (preview branch `feat/public-cleanup`):
  - Public pages no longer show relevance scores, internal source ids, the story "evidence confidence" badge, the "Private intelligence" header link, the "run the first scan from the private dashboard" hint or the homepage "SYSTEM READY" block. An empty section says "Δεν υπάρχουν ακόμη ειδήσεις σε αυτήν την ενότητα." / "No stories in this section yet." Story cards show the publisher name instead of a source id.
  - Outgoing links and titles are cleaned at display time (`src/public-links.js`; stored data is untouched): `utm_*`, click ids (`fbclid`, `gclid`, …) and similar tracking parameters are stripped; Google News links are unwrapped when the original URL is in the row's metadata, in a `url=`/`q=` parameter or in a legacy plain-text token (the same unwrap now also runs at ingest in `resolveGoogleNewsItems` before any network resolve); a link that can't be unwrapped is kept and the item is labelled "via Google News"; a trailing " - Source" / " – Source" title suffix is removed when it matches the item's source, including in story evidence; for Google News items the publisher is read from the feed description (confirmed by the title's own tail), whose "&nbsp;" noise and title-repeating text are cleaned.
  - `/tenders` and `/regulators` stay out of the nav, footer and sitemap (EL and EN) until each has >=3 items; the count now comes from the same selection the section page lists (`navVisibilityFromRows`). The homepage no longer links to a held-back section either.
  - `/subscribe`: the dead "Σύντομα"/"starts soon" teaser note now says the first weekly issue is being prepared and sign-up opens soon; while the newsletter env vars are missing (the API answers 503) the form is replaced by that notice instead of a form that cannot work.
  - Every public page (homepage, `/telco` `/energy` `/infrastructure` `/deals` `/tenders` `/regulators`, `/search`) now uses the Greek-first landing shell, and has an English twin under `/en` (new `/en` homepage, `/en/<section>`, `/en/search`). The ΕΛ/EN toggle goes to the same page in the other language from every page, and the wordmark goes to the homepage. The homepage and section pages carry `<link rel=canonical>` and hreflang (el/en/x-default); the sitemap lists both languages with alternates. `/en/search?` is disallowed in robots.txt. The old English-only `(site)/(public)` shell, `PublicHeader`, `PublicFooter` and `ArticleList` are removed; `/intelligence` and `/login` are unchanged.
- Homepage: the Daily Market Story block is removed from the public homepage. The `DailyStory` component, story generation in ingest and the `/search` story archive are unchanged.
- Insights #1 (AI in Greek SMEs) and #2 (fibre switch), EL + EN, published: the DRAFT/ΠΡΟΣΧΕΔΙΟ marker is removed from each file's first comment, so the pages are indexable, drop the draft label and appear in the sitemap.

### Added
- Round-4 feed rules: homepage backfill (fills to 12 items from up to 7-day-old coverage when
  fewer than 12 are <72h old, `article.homepageBackfill`); event/conference-piece suppression
  (`isEventPiece`/`hasFigureOrDecisionSignal` in `feed-rules.js`) with a homepage ban (never lead,
  figure/decision-word exception for recent/columns only) and a 1-per-section cap on section
  pages (`event_cap`); `telecom-fibre` now requires an actual network/technology/operator angle
  (`hasTelecomNetworkAngle`), dropping telco-only items with none (`telco_no_network_angle`);
  stock-market noise (target price, broker rating + σύσταση/broker context, buyback language) in
  a new `NOISE_HARD_REJECT.stock_market` group; Cyprus-only items (`isCyprusOnly`) excluded from
  the homepage but still shown on section pages; and Tier-1 sources (now carrying a `tier` field
  in `config/sources.js`) always get `regulators-policy` plus a topical section via the broader
  §1 keywords (`watch-rules.js` `sourceForcedCategories`), fixing ΡΑΑΕΥ/ΓΓΤΤ items that matched no
  `DEFAULT_WATCH_RULES` rule and so were silently dropped by `rankItems`. ΥΠΕΝ switched from a
  blind html-listing scrape to WordPress REST (category 7, `titleFilter` energy prefilter); ΓΓΤΤ
  gets a dedicated `ggtt` adapter (`src/sources/ggtt.js`) restricted to `/posts/<slug>` links with
  Greek-date/"Η προθεσμία έληξε" title parsing. `scanMarket` takes an optional `onDrop(item,
  reason)` covering noise/relevance_rejected/no_category/day_cap/run_cap/link_invalid/
  max_relevant. `/tenders` and `/regulators` are hidden from the public nav, footer and sitemap
  until their section has >=3 items in the last 30 days (`computeNavVisibility`/
  `getNavVisibility`) — the pages still resolve. `buildHomepageSections` now reports at most one
  drop per (url, stage) instead of once per internal pass. `scripts/review-dump.js` surfaces all
  of the above: scanMarket-level drops, `homepageBackfill`, a lead-selection `leadReason`,
  section-level drops, `navVisibility`, and a per-source `droppedByStage` breakdown.

- Bilingual subscribe/landing page (EL default at `/subscribe`, EN at `/en/subscribe`), plus
  `/subscribe/confirmed`, `/unsubscribe` and `/privacy` (and their `/en/...` equivalents). Built
  from `landing-copy.md`/`subscribe-flow.md`/`mockup.html`: hero, first-series teaser (telecom
  launch focus), "what you get", a real-data sample section (latest telco/energy/infrastructure
  article per section, via `getLatestArticles`, hidden entirely if there's no DB or no results —
  no invented figures), "how we work", a second CTA and footer. Both subscribe forms are plain
  HTML (`email`, a required `consent` checkbox, hidden `lang`/`sourcePage`, and an invisible
  honeypot field) and work without JS; the `?status=` banner is a small client component inside
  `<Suspense>` so the pages themselves stay static/ISR (`revalidate = 3600`).
- `src/landing/`: `copy.js` (centralised EL/EN strings — the GDPR consent paragraph is imported
  from `src/newsletter/service.js` rather than duplicated, so the displayed text can never drift
  from what `CONSENT_TEXT_VERSION` records as shown), `routes.js` (EL/EN route map), `metadata.js`
  (`buildLandingMetadata()`: canonical URL, `hreflang` alternates incl. `x-default`, Open Graph/
  Twitter), and `fonts.js` (JetBrains Mono / Source Sans 3 / Source Serif 4 via `next/font/google`,
  Greek + Latin subsets). New `src/app/landing.css`, loaded only by the landing layouts — the
  existing site styles are untouched.
- The app now has three root layouts via route groups, so each gets the right `<html lang>`:
  `src/app/(site)/layout.js` (`lang="en"`, unchanged — the existing site, moved as-is from
  `src/app/layout.js`), `src/app/(landing-el)/layout.js` (`lang="el"`) and
  `src/app/(landing-en)/layout.js` (`lang="en"`). `src/app/global-not-found.js` plus
  `experimental.globalNotFound` in `next.config.mjs` handle 404s for URLs that match none of the
  three groups, since there's no longer a single top-level layout to compose one from.
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
- Removed the `μερισμα (unless sector org)` dividend exception in `noiseRejectReason` — any
  dividend mention is noise now, sector company or not (round-4 owner answer, supersedes the
  earlier decision).
- Newsletter routes are now language-aware end to end: `POST /api/newsletter/subscribe` redirects
  to `/en/subscribe` or `/subscribe` by `lang` (no longer leaks `lang` into the query string) and
  now wraps the service call in try/catch (`newsletter subscribe failed: <message>` only, never
  the email or config); `GET /api/newsletter/confirm` redirects EN subscribers to
  `/en/subscribe/confirmed` (`store.confirmByTokenHash`/`service.confirm` now return the
  subscriber's `lang`), and localizes a failed/expired-token redirect via a `lang=en` hint carried
  in the confirmation link itself. `service.sendToSubscriber` now sends two different unsubscribe
  URLs: the `List-Unsubscribe`/`List-Unsubscribe-Post` headers point at the API route (RFC 8058
  requires it to accept POST), while the visible link in the email body points at the human
  `/unsubscribe` (or `/en/unsubscribe`) page, labelled "Διαγραφή"/"Unsubscribe" per subscriber
  language.
- `POST /api/newsletter/unsubscribe` now tells apart an RFC 8058 one-click POST (body is exactly
  `List-Unsubscribe=One-Click`, response stays `200 "Unsubscribed"`) from a plain browser form post
  from the new `/unsubscribe` page (body `lang=el`/`lang=en`, response is now a `303` to
  `/unsubscribe?status=done` or `/en/unsubscribe?status=done`).
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
