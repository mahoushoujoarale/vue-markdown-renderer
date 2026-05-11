import { visit } from "unist-util-visit";
import { computed, defineComponent, h } from "vue";
import { useProxyProps } from "../useProxyProps.js";

export const remarkEchartCodeBlock = () => {
  return (tree, file) => {
    const unclosedLang = (file as any).data?.unclosedFenceLang;
    visit(tree, "code", (node, index, parent) => {
      if (node.lang === "echarts") {
        // 流式场景：代码块未关闭时，直接展示 placeholder，避免不完整的 JSON 解析导致频繁重渲染
        if (unclosedLang === "echarts") {
          const placeholder = {
            type: "EchartCodeBlock",
            data: {
              hName: "EchartCodeBlock",
              hProperties: {
                placeholder: "vue-mdr-default-echart-placeholder-key",
              },
            },
          };
          parent.children.splice(index, 1, placeholder);
          return;
        }

        try {
          const data = JSON.parse(node.value);
          const echartCodeBlock = {
            type: "EchartCodeBlock",
            data: {
              hName: "EchartCodeBlock",
              hProperties: {
                optionJson: JSON.stringify(data),
              },
            },
          };
          parent.children.splice(index, 1, echartCodeBlock);
        } catch (e) {
          const placeholder = {
            type: "EchartCodeBlock",
            data: {
              hName: "EchartCodeBlock",
              hProperties: {
                placeholder: "vue-mdr-default-echart-placeholder-key",
              },
            },
          };
          parent.children.splice(index, 1, placeholder);
        }
      }
    });
  };
};

const EchartWrapper = defineComponent({
  props: ["optionJson"],
  setup(props) {
    const proxyProps = useProxyProps();
    const echartRenderer = computed(() => proxyProps.echartRenderer || {});

    return () => {
      if (!echartRenderer.value) {
        throw new Error(`echartRenderer must be provided`);
      }
      return h(echartRenderer.value!, {
        option: JSON.parse(props.optionJson),
      });
    };
  },
});

const Placeholder = defineComponent({
  setup() {
    return () => {
      return h("div", { class: "vue-mdr-default-echart-placeholder" });
    };
  },
});

export const EchartCodeBlock = defineComponent({
  name: "echart-code-block",
  inheritAttrs: false,

  props: {
    node: {
      type: Object,
      required: true,
    },
  },
  setup(props) {
    const proxyProps = useProxyProps();
    const echartRendererPlaceholder = computed(
      () => proxyProps.echartRendererPlaceholder || {}
    );

    return () => {
      const properties = props.node.properties;
      if (properties.placeholder) {
        return h(echartRendererPlaceholder.value || Placeholder);
      }

      return h(EchartWrapper, {
        optionJson: properties.optionJson,
      });
    };
  },
});
