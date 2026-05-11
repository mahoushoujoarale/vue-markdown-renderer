import { visit } from "unist-util-visit";
import { computed, defineComponent, h } from "vue";
import { useProxyProps } from "../useProxyProps.js";

export const remarkComponentCodeBlock = () => {
  return (tree, file) => {
    const unclosedLang = (file as any).data?.unclosedFenceLang;
    visit(tree, "code", (node, index, parent) => {
      if (node.lang === "component-json") {
        // 流式场景：代码块未关闭时，直接展示 placeholder，避免不完整的 JSON 解析导致频繁重渲染
        if (unclosedLang === "component-json") {
          const placeholder = {
            type: "ComponentCodeBlock",
            data: {
              hName: "ComponentCodeBlock",
              hProperties: {
                placeholder: "vue-mdr-default-component-placeholder-key",
              },
            },
          };
          parent.children.splice(index, 1, placeholder);
          return;
        }

        if (!node.meta) {
          try {
            const data = JSON.parse(node.value);
            const componentCodeBlock = {
              type: "ComponentCodeBlock",
              data: {
                hName: "ComponentCodeBlock",
                hProperties: {
                  componentDataJson: JSON.stringify(data),
                },
              },
            };
            parent.children.splice(index, 1, componentCodeBlock);
            return;
          } catch (e) {
            const placeholder = {
              type: "ComponentCodeBlock",
              data: {
                hName: "ComponentCodeBlock",
                hProperties: {
                  placeholder: "vue-mdr-default-component-placeholder-key",
                },
              },
            };
            parent.children.splice(index, 1, placeholder);
            return;
          }
        }
        try {
          const meta = JSON.parse(node.meta);
          try {
            const data = JSON.parse(node.value);
            const componentCodeBlock = {
              type: "ComponentCodeBlock",
              data: {
                hName: "ComponentCodeBlock",
                hProperties: {
                  componentDataJson: JSON.stringify(data),
                },
              },
            };
            parent.children.splice(index, 1, componentCodeBlock);
          } catch (e) {
            const placeholder = {
              type: "ComponentCodeBlock",
              data: {
                hName: "ComponentCodeBlock",
                hProperties: {
                  placeholder: meta.placeholder,
                },
              },
            };
            parent.children.splice(index, 1, placeholder);
          }
        } catch (e) {}
      }
    });
  };
};

const ComponentWrapper = defineComponent({
  props: ["component", "componetPropsJson"],
  setup(props) {
    return () => {
      return h(props.component, JSON.parse(props.componetPropsJson));
    };
  },
});

const Placeholder = defineComponent({
  setup() {
    return () => {
      return h("div", { class: "vue-mdr-default-component-placeholder" });
    };
  },
});

export const ComponentCodeBlock = defineComponent({
  name: "component-code-block",
  inheritAttrs: false,

  props: {
    node: {
      type: Object,
      required: true,
    },
  },
  setup(props) {
    const proxyProps = useProxyProps();
    const computedComponentsMap = computed(
      () => proxyProps.componentsMap || {}
    );

    return () => {
      const properties = props.node.properties;
      if (properties.placeholder) {
        const target = computedComponentsMap.value[properties.placeholder];
        if (target === undefined && properties.placeholder !== "vue-mdr-default-component-placeholder-key") {
          console.warn(
            `${properties.placeholder} does not exist in componentsMap, the built-in 'Placeholder' will be used instead.`
          );
        }
        return h(target || proxyProps.componentRendererPlaceholder || Placeholder);
      }

      const componentData = JSON.parse(properties.componentDataJson ?? "{}");
      const component = computedComponentsMap.value[componentData.type];
      if (component === undefined) {
        throw new Error(
          `${componentData.type} not exist in componentsMap:${JSON.stringify(computedComponentsMap.value, null, 2)}`
        );
      }
      return h(ComponentWrapper, {
        component,
        componetPropsJson: JSON.stringify(componentData.props),
      });
    };
  },
});
