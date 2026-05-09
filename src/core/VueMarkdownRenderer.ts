import {
  h,
  defineComponent,
  type PropType,
  computed,
  type Component,
  type DefineComponent,
  provide,
  reactive,
} from "vue";
import { Fragment } from "vue/jsx-runtime";
import { toJsxRuntime } from "hast-util-to-jsx-runtime";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import remarkGfm, { Options as RemarkGfmOptions } from "remark-gfm";
import { unified, type Plugin } from "unified";
import rehypeHighlight from "rehype-highlight";
import rehypeKatex from "rehype-katex";
import rehypeExternalLinks from "rehype-external-links";
import remarkMath from "remark-math";
import "katex/dist/katex.min.css";
import {
  remarkComponentCodeBlock,
  ComponentCodeBlock,
} from "./plugin/remarkComponentCodeBlock.js";
import {
  remarkEchartCodeBlock,
  EchartCodeBlock,
} from "./plugin/remarkEchartCodeBlock.js";
import { remarkCompleteTable } from "./plugin/remarkCompleteTable.js";
import { rehypeCodeBlock } from "./plugin/rehypeCodeBlock.js";
import { rehypeTable } from "./plugin/rehypeTable.js";
import { rehypeSanitizeHtml } from "./plugin/rehypeSanitizeHtml.js";
import { rehypeRestoreCustomTags } from "./plugin/rehypeRestoreCustomTags.js";
import { provideProxyProps } from "./useProxyProps.js";
import CodeBlock from "./CodeBlock.js";
import { TableRenderer } from "./components/TableRenderer.js";
import rehypeRaw from "rehype-raw";
import { SegmentedParser } from "./segmenter.js";
import { markdownRendererOptionsKey } from "./symbol.js";
import type { ResolvedRendererOptions } from "./apiOptions.js";

interface RemarkRehypeOptions {
  [key: string]: any;
}

function jsx(type: any, props: Record<any, any>, key: any) {
  const { children } = props;
  delete props.children;
  if (arguments.length > 2) props.key = key;
  if (type === Fragment) return h(type, props, children);
  if (typeof type !== "string")
    return h(type, props, { default: () => children });
  delete props.node;
  return h(type, props, children);
}

const VueMarkdownRenderer = defineComponent({
  name: "VueMarkdownRenderer",
  props: {
    source: {
      type: String as PropType<string>,
      required: true,
    },
    theme: {
      type: String as PropType<"light" | "dark">,
      required: true,
    },
    nodeRenderers: {
      type: Object as PropType<Record<string, Component>>,
    },
    componentsMap: {
      type: Object as PropType<Record<string, Component>>,
    },
    codeBlockRenderer: {
      type: Object as PropType<Component>,
    },
    echartRenderer: {
      type: Object as PropType<Component>,
    },
    echartRendererPlaceholder: {
      type: Object as PropType<Component>,
    },
    mermaidRenderer: {
      type: Object as PropType<Component>,
    },
    tableRenderer: {
      type: Object as PropType<Component>,
    },
    extraLangs: {
      type: Array as PropType<string[]>,
      default: () => [],
    },
    rehypePlugins: {
      type: Array as PropType<Plugin[]>,
      default: () => [],
    },
    remarkPlugins: {
      type: Array as PropType<Plugin[]>,
      default: () => [],
    },
    remarkRehypeOptions: {
      type: Object as PropType<RemarkRehypeOptions>,
      default: () => ({ allowDangerousHtml: true }),
    },
    remarkGfmOptions: {
      type: Object as PropType<RemarkGfmOptions>,
      default: () => ({}),
    },
  },
  errorCaptured(e) {
    console.error("VueMarkdownRenderer captured error", e);
  },
  setup(props) {
    provideProxyProps(props);

    const resolvedOptions = reactive<ResolvedRendererOptions>({
      renderers: {
        nodes: {},
        components: {},
      },
    });

    const updateOptions = () => {
      resolvedOptions.renderers = {
        nodes: props.nodeRenderers ?? props.componentsMap ?? {},
        components: props.componentsMap ?? {},
        codeBlock: props.codeBlockRenderer,
        mermaid: props.mermaidRenderer,
        echart: props.echartRenderer
          ? {
              renderer: props.echartRenderer,
              placeholder: props.echartRendererPlaceholder,
            }
          : undefined,
        table: props.tableRenderer,
      };
    };
    updateOptions();
    provide(markdownRendererOptionsKey, resolvedOptions);

    const computedProcessor = computed(() => {
      const {
        rehypePlugins,
        remarkPlugins,
        remarkRehypeOptions,
        remarkGfmOptions,
      } = props;
      return unified()
        .use(remarkParse)
        .use(remarkGfm, remarkGfmOptions)
        .use(remarkCompleteTable)
        .use(remarkComponentCodeBlock)
        .use(remarkEchartCodeBlock)
        .use(remarkMath)
        .use(remarkPlugins)
        .use(remarkRehype, remarkRehypeOptions)
        .use(rehypeRaw)
        .use(rehypeRestoreCustomTags)
        .use(rehypeSanitizeHtml)
        .use(rehypeKatex, {
          throwOnError: true,
          strict: false,
          errorColor: "inherit",
        })
        .use(rehypeExternalLinks, { target: "_blank", rel: ["nofollow"] })
        .use(rehypeCodeBlock)
        .use(rehypeHighlight, {
          detect: true,
          ignoreMissing: true,
          aliases: { xml: "vue" },
        })
        .use(rehypeTable)
        .use(rehypePlugins);
    });

    const parser = new SegmentedParser();

    const computedVNode = computed(() => {
      const children = parser.parse(props.source, computedProcessor.value);
      return toJsxRuntime({ type: "root", children } as any, {
        components: {
          ComponentCodeBlock,
          EchartCodeBlock,
          pre: CodeBlock,
          TableRenderer,
          ...(props.nodeRenderers ?? {}),
          ...(props.componentsMap ?? {}),
        },
        Fragment,
        jsx,
        jsxs: jsx,
        passKeys: true,
        passNode: true,
      });
    });

    return () => computedVNode.value;
  },
});

export default VueMarkdownRenderer as DefineComponent<{
  source: string;
  theme: "light" | "dark";
  nodeRenderers?: Partial<Record<string, Component>>;
  componentsMap?: Record<string, Component>;
  codeBlockRenderer?: Component;
  echartRenderer?: Component;
  echartRendererPlaceholder?: Component;
  mermaidRenderer?: Component;
  tableRenderer?: Component;
  extraLangs?: string[];
  rehypePlugins?: Plugin[];
  remarkPlugins?: Plugin[];
  remarkRehypeOptions?: RemarkRehypeOptions;
  remarkGfmOptions?: RemarkGfmOptions;
}>;
