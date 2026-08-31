import { getSql } from "./database";
import { collapseDuplicateArticles } from "./article-quality.js";
import { DEFAULT_WATCH_RULES, rankItems } from "./watch-rules.js";

export const PUBLIC_CATEGORIES = {
  finance: {
    name: "Finance",
    deck: "Banks, listed companies, capital markets and the Greek economy.",
  },
  telco: {
    name: "Telecom Infrastructure",
    deck: "Fibre, mobile networks, regulation and digital infrastructure.",
  },
  energy: {
    name: "Energy Infrastructure",
    deck: "Power grids, storage, interconnections and energy investment.",
  },
  infrastructure: {
    name: "Infrastructure",
    deck: "Construction, concessions, transport, data centres and strategic projects.",
  },
};

export async function getLatestArticles({ category, query, limit = 80 } = {}) {
  const sql = getSql();
  if (!sql) return [];
  try {
    let rows;
    const queryLimit = Math.min(Math.max(limit * 3, limit), 300);
    if (category && query) {
      const pattern = `%${query}%`;
      rows = await sql`
        SELECT * FROM articles
        WHERE title ILIKE ${pattern} OR summary ILIKE ${pattern}
        ORDER BY published_at DESC NULLS LAST LIMIT ${queryLimit}
      `;
    } else if (category) {
      rows = await sql`
        SELECT * FROM articles
        ORDER BY published_at DESC NULLS LAST LIMIT ${queryLimit}
      `;
    } else if (query) {
      const pattern = `%${query}%`;
      rows = await sql`
        SELECT * FROM articles
        WHERE title ILIKE ${pattern} OR summary ILIKE ${pattern}
        ORDER BY published_at DESC NULLS LAST LIMIT ${queryLimit}
      `;
    } else {
      rows = await sql`
        SELECT * FROM articles
        ORDER BY published_at DESC NULLS LAST LIMIT ${queryLimit}
      `;
    }
    let cleaned = collapseDuplicateArticles(rows).map(reclassifyRow);
    if (category) cleaned = cleaned.filter((row) => row.categories.includes(category));
    return cleaned.slice(0, limit).map(toArticle);
  } catch (error) {
    console.error("[public] article read failed:", error?.message || error);
    return [];
  }
}

export async function getHomepageData() {
  const articles = await getLatestArticles({ limit: 100 });
  return {
    articles,
    lead: articles[0] || null,
    recent: articles.slice(1, 13),
    categories: Object.fromEntries(
      Object.keys(PUBLIC_CATEGORIES).map((category) => [
        category,
        articles.filter((article) => article.categories.includes(category)).slice(0, 5),
      ]),
    ),
  };
}

function toArticle(row) {
  return {
    id: row.id,
    url: row.canonical_url,
    title: row.title,
    summary: row.summary,
    publishedAt: row.published_at ? new Date(row.published_at).toISOString() : null,
    sourceId: row.source_id,
    score: Number(row.score),
    categories: row.categories || [],
    relevance: row.relevance || [],
  };
}

function reclassifyRow(row) {
  const [ranked] = rankItems([{
    url: row.canonical_url,
    title: row.title,
    summary: row.summary,
    publishedAt: row.published_at,
    sourceId: row.source_id,
    metadata: row.metadata || {},
  }], DEFAULT_WATCH_RULES);
  return {
    ...row,
    categories: ranked?.relevance?.map((match) => match.category) || [],
    relevance: ranked?.relevance || [],
    score: ranked?.score || 0,
  };
}
