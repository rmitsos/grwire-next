export function decodeEntities(value = "") {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
}

export function stripTags(value = "") {
  return decodeEntities(value.replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ").trim();
}

export function absoluteUrl(value, baseUrl) {
  try { return new URL(decodeEntities(value), baseUrl).href; } catch { return null; }
}

export function firstTag(xml, tag) {
  const match = xml.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? decodeEntities(match[1]).trim() : undefined;
}

export function toIsoDate(value) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? undefined : date.toISOString();
}

export function normalizeItem(item, sourceUrl) {
  const url = absoluteUrl(item.url, sourceUrl);
  if (!url) throw new TypeError(`Invalid item URL: ${item.url}`);
  return {
    id: item.id || url,
    url,
    title: stripTags(item.title || "") || url,
    summary: stripTags(item.summary || "") || undefined,
    publishedAt: toIsoDate(item.publishedAt),
    sourceUrl,
    metadata: item.metadata || {}
  };
}
