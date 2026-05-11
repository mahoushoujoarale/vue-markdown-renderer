import { visit } from "unist-util-visit";
import { computed, defineComponent, h } from "vue";
import { useProxyProps } from "../useProxyProps.js";
import { MermaidRenderer } from "../components/MermaidRenderer.js";

export const remarkMermaidCodeBlock = () => {
  return (tree, file) => {
    const unclosedLang = (file as any).data?.unclosedFenceLang;
    visit(tree, "code", (node, index, parent) => {
      if (node.lang === "mermaid") {
        // 流式场景：代码块未关闭时，直接展示 placeholder，避免不完整的 mermaid 源码导致频繁重渲染
        if (unclosedLang === "mermaid") {
          const placeholder = {
            type: "MermaidCodeBlock",
            data: {
              hName: "MermaidCodeBlock",
              hProperties: {
                placeholder: "vue-mdr-default-mermaid-placeholder-key",
              },
            },
          };
          parent.children.splice(index, 1, placeholder);
          return;
        }

        const mermaidCodeBlock = {
          type: "MermaidCodeBlock",
          data: {
            hName: "MermaidCodeBlock",
            hProperties: {
              code: node.value,
            },
          },
        };
        parent.children.splice(index, 1, mermaidCodeBlock);
      }
    });
  };
};

const Placeholder = defineComponent({
  setup() {
    return () => {
      return h("div", { class: "vue-mdr-default-mermaid-placeholder" });
    };
  },
});

export const MermaidCodeBlock = defineComponent({
  name: "mermaid-code-block",
  inheritAttrs: false,

  props: {
    node: {
      type: Object,
      required: true,
    },
  },
  setup(props) {
    const proxyProps = useProxyProps();
    const mermaidRendererPlaceholder = computed(
      () => proxyProps.mermaidRendererPlaceholder || {}
    );

    return () => {
      const properties = props.node.properties;
      if (properties.placeholder) {
        return h(mermaidRendererPlaceholder.value || Placeholder);
      }

      return h(MermaidRenderer, { code: properties.code });
    };
  },
});
