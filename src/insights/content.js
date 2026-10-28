// Pure insights content loader: reads content/insights/*.md and parses them into a plain JSON
// AST. No Next.js imports here so this file (and parseInsight) can be exercised directly under
// `node --test`. Only getInsight/listInsights touch the filesystem; parseInsight itself is pure.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

export const INSIGHT_ORDER = ["fibre-switch", "ai-greek-smes"];
export const INSIGHT_LANGS = ["el", "en"];

const CONTENT_DIR = path.join(process.cwd(), "content", "insights");

const COMMENT_RE = /<!--[\s\S]*?-->/g;
const DRAFT_MARKER_RE = /DRAFT|ΠΡΟΣΧΕΔΙΟ/;

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findContentFile(slug, lang) {
  if (!existsSync(CONTENT_DIR)) return null;
  const pattern = new RegExp(`^\\d+-${escapeRegExp(slug)}\\.${lang}\\.md$`);
  const match = readdirSync(CONTENT_DIR).find((name) => pattern.test(name));
  return match ? path.join(CONTENT_DIR, match) : null;
}

export function getInsight(slug, lang) {
  const filePath = findContentFile(slug, lang);
  if (!filePath) return null;
  const markdown = readFileSync(filePath, "utf8");
  return parseInsight(markdown, { slug, lang });
}

export function listInsights(lang) {
  return INSIGHT_ORDER.map((slug) => getInsight(slug, lang)).filter(Boolean);
}

export function insightStaticParams(lang) {
  return listInsights(lang).map((insight) => ({ slug: insight.slug }));
}

export function insightPath(slug, lang) {
  return lang === "en" ? `/en/insights/${slug}` : `/insights/${slug}`;
}

export function insightsIndexPath(lang) {
  return lang === "en" ? "/en/insights" : "/insights";
}

// ---- inline markdown -------------------------------------------------------------------------

const INLINE_RE = /\*\*([^*]+?)\*\*|\*([^*]+?)\*|`([^`]+?)`|\[([^\]]+?)\]\(([^)]+?)\)|(https?:\/\/[^\s)]+)/g;

export function parseInline(text) {
  const nodes = [];
  let lastIndex = 0;
  let match;
  INLINE_RE.lastIndex = 0;
  while ((match = INLINE_RE.exec(text))) {
    if (match.index > lastIndex) nodes.push({ t: "text", v: text.slice(lastIndex, match.index) });
    if (match[1] !== undefined) nodes.push({ t: "bold", v: match[1] });
    else if (match[2] !== undefined) nodes.push({ t: "italic", v: match[2] });
    else if (match[3] !== undefined) nodes.push({ t: "code", v: match[3] });
    else if (match[4] !== undefined) nodes.push({ t: "link", text: match[4], url: match[5] });
    else if (match[6] !== undefined) nodes.push({ t: "link", text: match[6], url: match[6] });
    lastIndex = INLINE_RE.lastIndex;
  }
  if (lastIndex < text.length) nodes.push({ t: "text", v: text.slice(lastIndex) });
  return nodes;
}

function flattenInline(nodes) {
  return nodes
    .map((node) => {
      if (node.t === "link") return node.text;
      if (node.v !== undefined) return node.v;
      return "";
    })
    .join("");
}

function wordCount(text) {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

// ---- block markdown ---------------------------------------------------------------------------

function splitTableRow(line) {
  let row = line.trim();
  if (row.startsWith("|")) row = row.slice(1);
  if (row.endsWith("|")) row = row.slice(0, -1);
  return row.split("|").map((cell) => cell.trim());
}

const TABLE_SEPARATOR_RE = /^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?$/;

// Raw blocks: headings/paragraphs/lists/tables/etc carry un-parsed markdown text. Inline parsing
// happens afterwards, once chart/sources/method have been split out of the plain body.
function parseBlocksRaw(lines) {
  const blocks = [];
  let i = 0;
  while (i < lines.length) {
    const trimmed = lines[i].trim();
    if (trimmed === "") {
      i += 1;
      continue;
    }

    let m = /^###\s+(.*)$/.exec(trimmed);
    if (m) {
      blocks.push({ type: "heading", level: 3, text: m[1].trim() });
      i += 1;
      continue;
    }
    m = /^##\s+(.*)$/.exec(trimmed);
    if (m) {
      blocks.push({ type: "heading", level: 2, text: m[1].trim() });
      i += 1;
      continue;
    }
    if (/^-{3,}$/.test(trimmed)) {
      blocks.push({ type: "hr" });
      i += 1;
      continue;
    }
    if (/^>\s?/.test(trimmed)) {
      const quoteLines = [];
      while (i < lines.length && /^>\s?/.test(lines[i].trim())) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ""));
        i += 1;
      }
      blocks.push({ type: "blockquote", text: quoteLines.join(" ") });
      continue;
    }
    if (/^\|.*\|$/.test(trimmed)) {
      const header = splitTableRow(trimmed);
      i += 1;
      if (i < lines.length && TABLE_SEPARATOR_RE.test(lines[i].trim())) i += 1;
      const rows = [];
      while (i < lines.length && /^\|.*\|$/.test(lines[i].trim())) {
        rows.push(splitTableRow(lines[i].trim()));
        i += 1;
      }
      blocks.push({ type: "table", header, rows });
      continue;
    }
    if (/^-\s+/.test(trimmed)) {
      const items = [];
      while (i < lines.length && /^-\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^-\s+/, ""));
        i += 1;
      }
      blocks.push({ type: "list", ordered: false, items });
      continue;
    }
    if (/^\d+\.\s+/.test(trimmed)) {
      const items = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+\.\s+/, ""));
        i += 1;
      }
      blocks.push({ type: "list", ordered: true, items });
      continue;
    }
    blocks.push({ type: "paragraph", text: trimmed });
    i += 1;
  }
  return blocks;
}

function inlineParseBlock(block) {
  switch (block.type) {
    case "heading":
      return { type: "heading", level: block.level, text: parseInline(block.text) };
    case "paragraph":
      return { type: "paragraph", text: parseInline(block.text) };
    case "blockquote":
      return { type: "blockquote", text: parseInline(block.text) };
    case "list":
      return { type: "list", ordered: block.ordered, items: block.items.map(parseInline) };
    case "table":
      return {
        type: "table",
        header: block.header.map(parseInline),
        rows: block.rows.map((row) => row.map(parseInline)),
      };
    default:
      return block; // hr
  }
}

function flattenBlockText(block) {
  switch (block.type) {
    case "heading":
    case "paragraph":
    case "blockquote":
      return flattenInline(block.text);
    case "list":
      return block.items.map(flattenInline).join(" ");
    case "table":
      return [block.header, ...block.rows]
        .flat()
        .map(flattenInline)
        .join(" ");
    default:
      return "";
  }
}

// ---- chart --------------------------------------------------------------------------------

function stripInlineMarkdown(text) {
  return text
    .replace(/\*\*([^*]+?)\*\*/g, "$1")
    .replace(/\*([^*]+?)\*/g, "$1")
    .replace(/`([^`]+?)`/g, "$1")
    .replace(/\[([^\]]+?)\]\([^)]+?\)/g, "$1");
}

function parseChartParagraph(rawText) {
  const captionMatch = /^\*\*([^*]+)\*\*/.exec(rawText);
  const caption = captionMatch ? captionMatch[1].trim() : "";
  const filenameMatch = /`([^`]+?\.png)`/.exec(rawText);
  const filename = filenameMatch ? filenameMatch[1] : null;
  const src = filename ? `/insights/${filename}` : null;

  const plain = stripInlineMarkdown(rawText);
  const sentenceMatch = /^[\s\S]*?\.(?=\s[A-ZΑ-Ω])/.exec(plain);
  const alt = sentenceMatch ? sentenceMatch[0].trim() : plain.trim();

  return { src, caption, alt, filename };
}

// ---- sources --------------------------------------------------------------------------------

function parseSourceItem(rawItem) {
  const urlMatch = /\s*(https?:\/\/\S+)\s*$/.exec(rawItem);
  if (urlMatch) {
    return { text: rawItem.slice(0, urlMatch.index).trim(), url: urlMatch[1] };
  }
  return { text: rawItem.trim(), url: null };
}

function stripWrappingAsterisk(text) {
  const match = /^\*([\s\S]+)\*$/.exec(text.trim());
  return match ? match[1].trim() : text.trim();
}

// ---- top-level parse --------------------------------------------------------------------------

function isChartHeading(text) {
  return text === "Chart" || text === "Γράφημα";
}

function isSourcesHeading(text) {
  return text === "Sources" || text === "Πηγές";
}

export function parseInsight(markdown, { slug, lang }) {
  const comments = [];
  const stripped = markdown.replace(COMMENT_RE, (match) => {
    comments.push(match.slice(4, -3).trim());
    return "";
  });
  const draft = comments.length > 0 && DRAFT_MARKER_RE.test(comments[0]);

  const lines = stripped.split("\n");

  let i = 0;
  while (i < lines.length && lines[i].trim() === "") i += 1;
  const kickerRaw = lines[i].trim();
  i += 1;

  while (i < lines.length && lines[i].trim() === "") i += 1;
  const title = lines[i].trim().replace(/^#\s+/, "");
  i += 1;

  while (i < lines.length && lines[i].trim() === "") i += 1;
  const standfirst = [];
  while (i < lines.length) {
    const trimmed = lines[i].trim();
    if (trimmed === "") {
      i += 1;
      continue;
    }
    if (trimmed === "---" || /^##\s/.test(trimmed)) break;
    standfirst.push(trimmed);
    i += 1;
  }
  if (i < lines.length && lines[i].trim() === "---") i += 1;

  const restBlocks = parseBlocksRaw(lines.slice(i));

  const sourcesHeadingIndex = restBlocks.findIndex(
    (block) => block.type === "heading" && block.level === 2 && isSourcesHeading(block.text),
  );
  const bodyBlocksRaw = sourcesHeadingIndex === -1 ? restBlocks : restBlocks.slice(0, sourcesHeadingIndex);

  const chartHeadingIndex = bodyBlocksRaw.findIndex(
    (block) => block.type === "heading" && block.level === 2 && isChartHeading(block.text),
  );
  let chart = null;
  let finalBodyBlocksRaw = bodyBlocksRaw;
  if (chartHeadingIndex !== -1) {
    const chartParagraph = bodyBlocksRaw[chartHeadingIndex + 1];
    chart = parseChartParagraph(chartParagraph ? chartParagraph.text : "");
    finalBodyBlocksRaw = bodyBlocksRaw
      .slice(0, chartHeadingIndex)
      .concat(bodyBlocksRaw.slice(chartHeadingIndex + 2));
  }

  const body = finalBodyBlocksRaw.map(inlineParseBlock);

  let sourcesHeading = null;
  let sources = [];
  let method = null;
  if (sourcesHeadingIndex !== -1) {
    sourcesHeading = restBlocks[sourcesHeadingIndex].text;
    const sourcesListBlock = restBlocks[sourcesHeadingIndex + 1];
    if (sourcesListBlock && sourcesListBlock.type === "list") {
      sources = sourcesListBlock.items.map(parseSourceItem);
    }
    const methodBlock = restBlocks
      .slice(sourcesHeadingIndex + 2)
      .find((block) => block.type === "paragraph");
    if (methodBlock) method = stripWrappingAsterisk(methodBlock.text);
  }

  const description = standfirst.join(" ");
  const wordTotal =
    wordCount(title) +
    standfirst.reduce((sum, line) => sum + wordCount(line), 0) +
    body.reduce((sum, block) => sum + wordCount(flattenBlockText(block)), 0);
  const readingMinutes = Math.max(1, Math.ceil(wordTotal / 200));

  return {
    slug,
    lang,
    draft,
    kicker: parseInline(kickerRaw),
    title,
    standfirst,
    body,
    chart,
    sourcesHeading,
    sources,
    method,
    date: null,
    readingMinutes,
    description,
  };
}
