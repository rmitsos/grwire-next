/**
 * Source Guardian: deterministic quality control for collected market items.
 *
 * This module deliberately does not claim that an article is true. It checks
 * whether the source is reachable/usable and whether the item matches the
 * configured market subject. A later model can replace the lexical similarity
 * function without changing the pipeline contract.
 */

const TRACKING_PARAMS = /^(utm_|fbclid|gclid|mc_cid|mc_eid)/i;
const STOP_WORDS = new Set([
  "the", "and", "for", "with", "from", "that", "this", "news", "about",
  "στη", "στην", "στο", "και", "για", "των", "της", "του", "με", "απο", "από",
]);

export function inspectArticle(item, { rules = [] } = {}) {
  const urlCheck = inspectUrl(item?.url);
  const title = cleanText(item?.title);
  const summary = cleanText(item?.summary);
  const text = `${title} ${summary}`.trim();
  const quality = contentQuality({ title, summary, text });
  const subject = subjectSimilarity({ title, summary, rules });
  const sourceDomain = urlCheck.domain;
  const accepted = Boolean(
    urlCheck.valid &&
    quality.score >= 30 &&
    subject.score >= 35,
  );

  return {
    accepted,
    status: accepted ? "accepted" : "review",
    url: urlCheck,
    content: quality,
    subject,
    sourceDomain,
    checkedAt: new Date().toISOString(),
  };
}

export function inspectUrl(value) {
  try {
    const url = new URL(value);
    for (const key of [...url.searchParams.keys()]) {
      if (TRACKING_PARAMS.test(key)) url.searchParams.delete(key);
    }
    const domain = url.hostname.replace(/^www\./i, "").toLowerCase();
    return {
      valid: Boolean(domain && ["http:", "https:"].includes(url.protocol)),
      status: "syntax-valid",
      canonicalUrl: url.href,
      domain,
    };
  } catch {
    return { valid: false, status: "invalid", canonicalUrl: null, domain: null };
  }
}

export async function validateArticleLink(item, { fetch = globalThis.fetch, timeoutMs = 5_000 } = {}) {
  const syntax = inspectUrl(item?.url);
  if (!syntax.valid) return { ...syntax, status: "invalid" };
  if (typeof fetch !== "function") return { ...syntax, status: "not-checked" };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(syntax.canonicalUrl, {
      method: "GET",
      redirect: "follow",
      headers: {
        "User-Agent": "GRWire/0.3 source-quality-check",
        Accept: "text/html,application/xhtml+xml,application/json;q=0.8,*/*;q=0.5",
      },
      signal: controller.signal,
    });
    const contentType = response.headers?.get?.("content-type") || "";
    return {
      ...syntax,
      valid: response.ok,
      status: response.ok ? "reachable" : `http-${response.status}`,
      httpStatus: response.status,
      finalUrl: response.url || syntax.canonicalUrl,
      contentType,
      blocked: response.status === 401 || response.status === 403 || /captcha|challenge/i.test(contentType),
    };
  } catch (error) {
    return {
      ...syntax,
      valid: false,
      status: error?.name === "AbortError" ? "timeout" : "unreachable",
      error: error?.message || String(error),
    };
  } finally {
    clearTimeout(timeout);
  }
}

export function discoverSourceCandidates(items = [], { knownDomains = [], minimumScore = 45 } = {}) {
  const known = new Set(knownDomains.map((domain) => String(domain).replace(/^www\./, "").toLowerCase()));
  const candidates = new Map();
  for (const item of items) {
    const check = inspectArticle(item);
    if (!check.url.valid || !check.sourceDomain || known.has(check.sourceDomain)) continue;
    const score = Math.round((check.content.score * 0.45) + (check.subject.score * 0.55));
    if (score < minimumScore) continue;
    const current = candidates.get(check.sourceDomain) || {
      domain: check.sourceDomain,
      exampleUrl: check.url.canonicalUrl,
      occurrences: 0,
      subjects: new Set(),
      score: 0,
    };
    current.occurrences += 1;
    current.score = Math.max(current.score, score);
    for (const subject of check.subject.matches) current.subjects.add(subject);
    candidates.set(check.sourceDomain, current);
  }
  return [...candidates.values()]
    .map((candidate) => ({ ...candidate, subjects: [...candidate.subjects] }))
    .sort((a, b) => b.occurrences - a.occurrences || b.score - a.score);
}

function cleanText(value) {
  return String(value || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function contentQuality({ title, summary, text }) {
  let score = 0;
  const reasons = [];
  if (title.length >= 18) { score += 35; reasons.push("usable title"); }
  else if (title.length >= 12) { score += 30; reasons.push("short title"); }
  if (summary.length >= 40) { score += 35; reasons.push("usable summary"); }
  else if (summary.length >= 12) { score += 18; reasons.push("short summary"); }
  if (text.length >= 80) { score += 20; reasons.push("sufficient text"); }
  if (!/^(untitled|undefined|null)$/i.test(title)) score += 10;
  return { score: Math.min(score, 100), label: score >= 70 ? "complete" : score >= 45 ? "partial" : "poor", reasons };
}

function subjectSimilarity({ title, summary, rules }) {
  const combined = `${title} ${summary}`.toLocaleLowerCase("el");
  const tokens = tokenise(combined);
  const matches = [];
  let best = 0;
  if (!rules?.length) return { score: combined.length >= 30 ? 60 : 25, matches };
  for (const rule of rules || []) {
    const terms = [...(rule.entities || []), ...(rule.topics || []), ...(rule.strongTopics || []), ...(rule.geography || [])];
    const matched = terms.filter((term) => containsTerm(combined, term));
    const termCoverage = terms.length ? matched.length / terms.length : 0;
    const tokenCoverage = matched.length ? matched.filter((term) => [...tokenise(term)].some((token) => tokens.has(token))).length / matched.length : 0;
    const score = Math.min(100, matched.length * 16 + Math.round(termCoverage * 35) + Math.round(tokenCoverage * 25));
    if (score > best) best = score;
    if (score >= 35) matches.push(rule.label || rule.id);
  }
  return { score: best, matches };
}

function containsTerm(text, term) {
  const normalised = String(term || "").toLocaleLowerCase("el").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const comparable = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return normalised.length >= 3 && comparable.includes(normalised);
}

function tokenise(value) {
  return new Set(value.toLocaleLowerCase("el").normalize("NFD").replace(/[\u0300-\u036f]/g, "").split(/[^\p{L}\p{N}]+/u).filter((token) => token.length > 2 && !STOP_WORDS.has(token)));
}
