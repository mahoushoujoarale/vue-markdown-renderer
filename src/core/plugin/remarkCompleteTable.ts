import type { Root, TableRow } from "mdast";
import { visit } from "unist-util-visit";

export const remarkCompleteTable = () => {
  return (tree) => {
    visit(tree, "paragraph", (node, index, parent) => {
      if (!parent || index == null) return;
      const text = node.children
        .filter((c) => c.type === "text")
        .map((c) => c.value)
        .join("");
      const lines = text.split("\n");
      if (/^\|.+\|/.test(lines[0])) {
        const rows: TableRow[] = lines
          .filter((l) => !/^\|[\s|:-]+\|?$/.test(l))
          .map((line) => ({
            type: "tableRow",
            children: line
              .split("|")
              .slice(1, -1)
              .map((c) => ({
                type: "tableCell",
                children: [{ type: "text", value: c.trim() }],
              })),
          }));
        parent.children.splice(index, 1, {
          type: "table",
          children: rows,
        });
      }
    });
  };
};
