import { parseInline } from "@/insights/content";

// Renders a pre-parsed inline AST (array of {t, v} / {t:"link", text, url} nodes), as produced by
// src/insights/content.js's parseInline(). Shared by the block renderer below and by the simple
// raw-string fields (kicker is already parsed; standfirst/sources/method are rendered via
// InlineText, which parses them on the fly).
export function renderInlineNodes(nodes, keyPrefix = "n") {
  return nodes.map((node, index) => {
    const key = `${keyPrefix}-${index}`;
    switch (node.t) {
      case "bold":
        return <strong key={key}>{node.v}</strong>;
      case "italic":
        return <em key={key}>{node.v}</em>;
      case "code":
        return <code key={key}>{node.v}</code>;
      case "link": {
        const external = /^https?:\/\//.test(node.url);
        return (
          <a key={key} href={node.url} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
            {node.text}
          </a>
        );
      }
      default:
        return node.v;
    }
  });
}

export function InlineText({ text }) {
  if (!text) return null;
  return <>{renderInlineNodes(parseInline(text))}</>;
}

function Block({ block, index }) {
  switch (block.type) {
    case "heading": {
      const Tag = block.level === 3 ? "h3" : "h2";
      return <Tag>{renderInlineNodes(block.text, `b${index}`)}</Tag>;
    }
    case "paragraph":
      return <p>{renderInlineNodes(block.text, `b${index}`)}</p>;
    case "blockquote":
      return <blockquote>{renderInlineNodes(block.text, `b${index}`)}</blockquote>;
    case "list": {
      const ListTag = block.ordered ? "ol" : "ul";
      return (
        <ListTag>
          {block.items.map((item, itemIndex) => (
            <li key={itemIndex}>{renderInlineNodes(item, `b${index}-${itemIndex}`)}</li>
          ))}
        </ListTag>
      );
    }
    case "table":
      return (
        <div className="insight-table-scroll">
          <table>
            <thead>
              <tr>
                {block.header.map((cell, cellIndex) => (
                  <th key={cellIndex}>{renderInlineNodes(cell, `b${index}-h${cellIndex}`)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex}>{renderInlineNodes(cell, `b${index}-r${rowIndex}-${cellIndex}`)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "hr":
      return <hr />;
    default:
      return null;
  }
}

export function Markdown({ blocks }) {
  return (
    <>
      {blocks.map((block, index) => (
        <Block block={block} index={index} key={index} />
      ))}
    </>
  );
}
