import { visit, SKIP } from "unist-util-visit";

const DANGEROUS_TAGS = new Set([
  "script",
  "style",
  "iframe",
  "object",
  "embed",
  "form",
  "input",
  "button",
  "textarea",
  "select",
  "link",
  "meta",
  "base",
  "noscript",
]);

function sanitizeProperties(props: Record<string, unknown>) {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(props)) {
    if (key.startsWith("on")) continue;
    if (key === "srcdoc") continue;
    if (
      (key === "href" || key === "src" || key === "action") &&
      typeof value === "string" &&
      /^javascript:/i.test(value.trim())
    ) {
      continue;
    }
    result[key] = value;
  }
  return result;
}

export const rehypeSanitizeHtml = () => (tree: any) => {
  visit(tree, "element", (node: any, index: any, parent: any) => {
    if (!parent || index == null) return;
    if (DANGEROUS_TAGS.has(node.tagName)) {
      parent.children.splice(index, 1);
      return [SKIP, index];
    }
    node.properties = sanitizeProperties(node.properties ?? {});
  });
};
