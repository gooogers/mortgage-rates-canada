/**
 * Remark plugin: auto-link the FIRST occurrence of each glossary term in
 * the MDX body. Subsequent occurrences in the same document are left as
 * plain text so the page doesn't read like Wikipedia. Terms are sourced
 * from src/data/glossary.ts via GLOSSARY_LINK_TERMS, which is sorted
 * longest-match-first.
 *
 * Skips:
 *   - headings (don't link in titles)
 *   - existing links (no nested links)
 *   - inline code and code blocks
 *   - emphasis-only nodes are fine; they get re-wrapped
 *
 * Word-boundary matched, case-insensitive. The matched substring becomes
 * the link text — preserves the author's casing so "Stress test" and
 * "stress test" both link cleanly.
 */
import { visit, SKIP } from "unist-util-visit";

const SKIP_PARENT_TYPES = new Set([
  "heading",
  "link",
  "linkReference",
  "inlineCode",
  "code",
]);

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export default function remarkGlossaryAutolink(options = {}) {
  const terms = options.terms ?? [];
  if (terms.length === 0) {
    return () => {};
  }

  return (tree) => {
    // One linked-set per document so first-occurrence-per-page is the rule.
    const linked = new Set();

    visit(tree, "text", (node, index, parent) => {
      if (!parent || index === undefined) return;
      if (SKIP_PARENT_TYPES.has(parent.type)) return;

      // Find the first matching term that hasn't been used yet in this doc.
      let earliest = null;
      for (const t of terms) {
        if (linked.has(t.anchor)) continue;
        const re = new RegExp(`\\b(${escapeRegExp(t.match)})\\b`, "i");
        const m = re.exec(node.value);
        if (!m) continue;
        if (!earliest || m.index < earliest.matchIndex) {
          earliest = { term: t, matchIndex: m.index, matched: m[0] };
        }
      }
      if (!earliest) return;

      const { term, matchIndex, matched } = earliest;
      const before = node.value.slice(0, matchIndex);
      const after = node.value.slice(matchIndex + matched.length);

      const linkNode = {
        type: "link",
        url: `/glossary#${term.anchor}`,
        title: `Definition: ${matched}`,
        data: { hProperties: { className: ["glossary-autolink"] } },
        children: [{ type: "text", value: matched }],
      };

      const replacement = [];
      if (before) replacement.push({ type: "text", value: before });
      replacement.push(linkNode);
      if (after) replacement.push({ type: "text", value: after });

      parent.children.splice(index, 1, ...replacement);
      linked.add(term.anchor);

      // Skip the inserted link node so we don't recurse into the link
      // text and wrap it in another link. Continue from after the link.
      return [SKIP, index + 2];
    });
  };
}
