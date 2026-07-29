import { ORGANIZATIONS } from "./organizations.js";

function normalise(value = "") {
  return value
    .toLocaleLowerCase("el")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function detectArticleOrganizations(article, organizations = ORGANIZATIONS) {
  const title = normalise(article.title);
  const summary = normalise(article.summary);
  return organizations.flatMap((organization) => {
    const names = [organization.name, ...(organization.aliases || [])].map(normalise);
    const titleMatch = names.find((name) => name && boundedIncludes(title, name));
    const summaryMatch = names.find((name) => name && boundedIncludes(summary, name));
    if (!titleMatch && !summaryMatch) return [];
    return [{
      organizationId: organization.id,
      matchKind: titleMatch ? "title_alias" : "summary_alias",
      confidence: titleMatch ? 1 : 0.8,
      matchedAlias: titleMatch || summaryMatch,
    }];
  });
}

function boundedIncludes(text, term) {
  if (term.length > 4) return text.includes(term);
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, "u").test(text);
}
