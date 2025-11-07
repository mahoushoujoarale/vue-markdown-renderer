import { defineComponent, h } from "vue";
import { useProxyProps } from "./useProxyProps.js";
import { toJsxRuntime } from "hast-util-to-jsx-runtime";
import { Fragment } from "vue/jsx-runtime";

interface CodeNode {
  type: "element";
  tagName: string;
  properties: {
    className?: string | string[];
  };
  children: Array<{
    type: "text";
    value: string;
  }>;
}

interface PreNode {
  children: Array<CodeNode>;
  classList: DOMTokenList;
  className: string;
}

function jsx(type: any, props: Record<any, any>, key: any) {
  const { children } = props;
  delete props.children;
  if (arguments.length > 2) {
    props.key = key;
  }
  if (type === Fragment) {
    return h(type, props, children);
  } else if (typeof type !== "string") {
    return h(type, props);
  }
  return h(type, props, children);
}

export default defineComponent({
  name: "CodeBlock",
  inheritAttrs: false,
  props: {
    node: {
      type: Object as () => PreNode,
      required: true,
    },
  },
  setup(props) {
    const proxyProps = useProxyProps();

    return () => {
      // 查找子元素中的 code 节点
      const codeNode = props.node.children.find(
        (child) =>
          child && typeof child === "object" && child.tagName === "code"
      ) as CodeNode | undefined;

      if (!codeNode) {
        // 如果没有找到 code 节点，直接返回 pre 元素
        return h("pre", { class: props.node.className });
      }

      // 提取语言信息（可能来自 class 属性）
      let language: string | null = null;
      if (codeNode.properties?.className) {
        const classNames = Array.isArray(codeNode.properties.className)
          ? codeNode.properties.className
          : [codeNode.properties.className];
        const langClass = classNames.find(
          (cls) =>
            typeof cls === "string" &&
            (cls.startsWith("language-") || cls.startsWith("lang-"))
        );
        if (langClass) {
          language = langClass.replace(/^(language-|lang-)/, "");
        }
      }

      // 检查是否有自定义的 codeBlockRenderer
      const customRenderer = proxyProps.codeBlockRenderer;
      if (customRenderer) {
        // 使用toJsxRuntime将codeNode转换为Vue vnode
        const highlightVnode = toJsxRuntime(codeNode, {
          Fragment,
          jsx: jsx,
          jsxs: jsx,
          passKeys: true,
          passNode: true,
        });

        // 将 highlightVnode 包装在 pre 元素中
        const wrappedVnode = h("pre", { class: props.node.className }, [highlightVnode]);

        return h(customRenderer, {
          language,
          highlightVnode: wrappedVnode,
          nodeJson: JSON.stringify(codeNode),
          preNode: props.node,
          className: codeNode.properties?.className || null,
          preClassName: props.node?.className,
        });
      }

      // 默认的代码块渲染
      return h("pre", { class: props.node.className }, [
        h(
          "code",
          { class: codeNode.properties?.className || null },
          codeNode.children?.[0]?.value || ""
        ),
      ]);
    };
  },
});
