import { visit } from "unist-util-visit";

const TAG_MAP: Record<string, string> = {
  echartcodeblock: "EchartCodeBlock",
  componentcodeblock: "ComponentCodeBlock",
};

export const rehypeRestoreCustomTags = () => (tree: any) => {
  visit(tree, "element", (node: any) => {
    const restored = TAG_MAP[node.tagName];
    if (restored) {
      node.tagName = restored;
    }
  });
};
