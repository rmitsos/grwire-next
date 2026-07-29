import { getSql } from "./database";

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
};

export async function getLatestArticles({ category, query, limit = 80 } = {}) {
  const sql = getSql();
  if (!sql) return [];
  try {
    let rows;
    if (category && query) {
      const pattern = `%${query}%`;
      rows = await sql`
        SELECT * FROM articles
        WHERE ${category} = ANY(categories)
          AND (title ILIKE ${pattern} OR summary ILIKE ${pattern})
        ORDER BY published_at DESC NULLS LAST LIMIT ${limit}
      `;
    } else if (category) {
      rows = await sql`
        SELECT * FROM articles
        WHERE ${category} = ANY(categories)
        ORDER BY published_at DESC NULLS LAST LIMIT ${limit}
      `;
    } else if (query) {
      const pattern = `%${query}%`;
      rows = await sql`
        SELECT * FROM articles
        WHERE title ILIKE ${pattern} OR summary ILIKE ${pattern}
        ORDER BY published_at DESC NULLS LAST LIMIT ${limit}
      `;
    } else {
      rows = await sql`
        SELECT * FROM articles
        ORDER BY published_at DESC NULLS LAST LIMIT ${limit}
      `;
    }
    return rows.map(toArticle);
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
