// Weekday digest: the day's top homepage stories (last 24h) plus an optional editor comment.
// Idempotent per subscriber per day through store.claimDigestSend (digest_sends primary key).

const DAY_MS = 24 * 60 * 60 * 1000;

export function athensDateKey(date) {
  // en-CA formats as YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Athens", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

export function isAthensWeekday(date) {
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Athens", weekday: "short" }).format(date);
  return !["Sat", "Sun"].includes(weekday);
}

// home: { lead, recent, columns } as built by buildHomepageSections (the page order is lead, recent, columns).
export function pickDigestStories(home, { now = Date.now(), max = 8, windowMs = DAY_MS } = {}) {
  const ordered = [
    home?.lead,
    ...(home?.recent || []),
    ...Object.values(home?.columns || {}).flatMap((column) => (Array.isArray(column) ? column : column?.articles || [])),
  ].filter(Boolean);
  const seen = new Set();
  const stories = [];
  for (const article of ordered) {
    if (!article.url || !article.title || seen.has(article.url)) continue;
    const published = Date.parse(article.publishedAt || "");
    if (!Number.isFinite(published) || now - published > windowMs || published > now + 3_600_000) continue;
    seen.add(article.url);
    stories.push({
      title: article.title,
      url: article.url,
      sourceName: article.sourceName || null,
      publishedAt: article.publishedAt,
      summary: article.summary || null,
    });
    if (stories.length >= max) break;
  }
  return stories;
}

function chunk(list, size) {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

export async function runDigest({ enabled, store, service, getHome, now = new Date(), batchSize = 10, maxStories = 8 }) {
  if (!enabled) return { ok: true, skipped: "disabled" };
  if (!isAthensWeekday(now)) return { ok: true, skipped: "weekend" };
  const sendDate = athensDateKey(now);
  const stories = pickDigestStories(await getHome(), { now: now.getTime(), max: maxStories });
  if (!stories.length) return { ok: true, skipped: "no-stories", sendDate };
  const comment = await store.getDigestComment(sendDate);
  const subscribers = await store.listConfirmed({ sendDate });
  const result = { ok: true, sendDate, stories: stories.length, subscribers: subscribers.length, sent: 0, failed: 0, alreadySent: 0 };
  for (const batch of chunk(subscribers, batchSize)) {
    await Promise.all(batch.map(async (subscriber) => {
      if (!(await store.claimDigestSend(subscriber.id, sendDate))) {
        result.alreadySent += 1;
        return;
      }
      try {
        await service.sendDigest({ subscriber, stories, comment: comment[subscriber.lang] || null, date: now });
        await store.markDigestSend(subscriber.id, sendDate, "sent");
        result.sent += 1;
      } catch (error) {
        // Only the error message, never the address or any credential.
        console.error("[newsletter] digest send failed:", error?.message || error);
        await store.markDigestSend(subscriber.id, sendDate, "failed").catch(() => {});
        result.failed += 1;
      }
    }));
  }
  return result;
}
