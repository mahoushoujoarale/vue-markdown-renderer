import { defineComponent, h, inject } from "vue";
import { useProxyProps } from "./useProxyProps.js";
import { toJsxRuntime } from "hast-util-to-jsx-runtime";
import { Fragment } from "vue/jsx-runtime";
import { MermaidRenderer } from "./components/MermaidRenderer.js";
import { markdownRendererOptionsKey } from "./symbol.js";

interface CodeElement {
  type: "element";
  tagName: string;
  properties: { className?: string | string[] };
  children: Array<{ type: "text"; value: string }>;
}

interface PreProperties {
  className?: string | string[];
  lang?: string;
  code?: string;
  meta?: string;
}

interface PreNode {
  children: Array<CodeElement>;
  properties: PreProperties;
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
    const options = inject(markdownRendererOptionsKey, null);

    return () => {
      const lang = props.node.properties?.lang as string | undefined;
      const code = props.node.properties?.code as string | undefined;

      if (lang === "mermaid" && options?.renderers?.mermaid !== undefined) {
        const mermaidCode = code ?? "";
        if (mermaidCode) {
          return h(MermaidRenderer, { code: mermaidCode });
        }
      }

      const codeNode = props.node.children.find(
        (child) =>
          child && typeof child === "object" && child.tagName === "code"
      ) as CodeElement | undefined;

      if (!codeNode) {
        return h("pre", { class: props.node.properties?.className as any });
      }

      const customRenderer =
        options?.renderers?.codeBlock ?? proxyProps.codeBlockRenderer;

      if (customRenderer) {
        const highlightVnode = toJsxRuntime(codeNode, {
          Fragment,
          jsx,
          jsxs: jsx,
          passKeys: true,
          passNode: true,
        });

        const wrappedVnode = h(
          "pre",
          { class: props.node.properties?.className as any },
          [highlightVnode]
        );

        return h(customRenderer, {
          language: lang,
          code,
          highlightVnode: wrappedVnode,
        });
      }

      const children = props.node.children.map((child) =>
        toJsxRuntime(child, {
          Fragment,
          jsx,
          jsxs: jsx,
          passKeys: true,
          passNode: true,
        })
      );

      return h(
        "pre",
        { class: props.node.properties?.className as any },
        children
      );
    };
  },
});
