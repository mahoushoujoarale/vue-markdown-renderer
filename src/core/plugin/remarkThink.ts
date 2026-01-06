import type { Plugin } from "unified";
import type { Node, Parent } from "unist";

interface ThinkNode extends Parent {
  type: "think";
}

const OPEN_RE = /^<think\s*>$/i;
const CLOSE_RE = /^<\/think\s*>$/i;

const remarkThink: Plugin = () => {
  return (tree) => {
    function visitParent(parent: Parent) {
      if (!Array.isArray(parent.children)) return;

      const children = parent.children;

      for (let i = 0; i < children.length; i++) {
        const node = children[i] as Node & { value?: string };

        if (
          node.type === "html" &&
          typeof node.value === "string" &&
          OPEN_RE.test(node.value.trim())
        ) {
          const collected: Node[] = [];
          let j = i + 1;
          let closed = false;

          for (; j < children.length; j++) {
            const next = children[j] as Node & { value?: string };

            if (
              next.type === "html" &&
              typeof next.value === "string" &&
              CLOSE_RE.test(next.value.trim())
            ) {
              closed = true;
              break;
            }

            collected.push(next);
          }

          if (!closed) continue;

          const thinkNode: ThinkNode = {
            type: "think",
            children: collected,
          };

          // 替换 <think> ... </think>
          children.splice(i, j - i + 1, thinkNode);

          i--; // 防止跳过后续节点
        }

        // 递归处理嵌套结构
        if ((node as Parent).children) {
          visitParent(node as Parent);
        }
      }
    }

    visitParent(tree as Parent);
  };
};

export default remarkThink;
