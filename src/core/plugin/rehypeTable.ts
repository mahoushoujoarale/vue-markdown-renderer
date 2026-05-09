import type { Element, ElementContent, Root } from "hast";
import { visit } from "unist-util-visit";

function isElement(node: ElementContent): node is Element {
  return (
    node.type === "element" &&
    typeof node.tagName === "string" &&
    Array.isArray(node.children)
  );
}

export const rehypeTable = () => {
  return (tree) => {
    visit(tree, "element", (node, index, parent) => {
      if (!parent || index == null) return;
      if (!isElement(node)) return;
      if (node.tagName !== "table") return;

      const tableNode: Element = {
        type: "element",
        tagName: "TableRenderer",
        properties: {
          // @ts-expect-error pass JS object as property since this runs after rehype
          ast: node,
        },
        children: [],
      };
      parent.children.splice(index, 1, tableNode);
    });
  };
};
