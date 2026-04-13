import {
  h,
  defineComponent,
  type PropType,
  computed,
  type Component,
  type DefineComponent,
} from "vue";
import { Fragment } from "vue/jsx-runtime";
import { toJsxRuntime } from "hast-util-to-jsx-runtime";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import remarkGfm, { Options as RemarkGfmOptions } from "remark-gfm";
import { unified, type Plugin } from "unified";
import rehypeHighlight from "rehype-highlight";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import type { Schema } from "hast-util-sanitize";
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
import { provideProxyProps } from "./useProxyProps.js";
import CodeBlock from "./CodeBlock";
import rehypeRaw from "rehype-raw";
import { SegmentedParser } from "./segmenter.js";

interface RemarkRehypeOptions {
  [key: string]: any;
}

function jsx(type: any, props: Record<any, any>, key: any) {
  const { children } = props;
  delete props.children;
  if (arguments.length > 2) props.key = key;
  if (type === Fragment) return h(type, props, children);
  if (typeof type !== "string") return h(type, props);
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
    rehypeSanitizeSchema: {
      type: Object as PropType<Partial<Schema>>,
      default: () => ({}),
    },
  },
  errorCaptured(e) {
    console.error("VueMarkdownRenderer captured error", e);
  },
  setup(props) {
    provideProxyProps(props);

    const computedProcessor = computed(() => {
      const {
        rehypePlugins,
        remarkPlugins,
        remarkRehypeOptions,
        remarkGfmOptions,
        rehypeSanitizeSchema,
      } = props;
      return unified()
        .use(remarkParse)
        .use(remarkGfm, remarkGfmOptions)
        .use(remarkComponentCodeBlock)
        .use(remarkEchartCodeBlock)
        .use(remarkMath)
        .use(remarkPlugins)
        .use(remarkRehype, remarkRehypeOptions)
        .use(rehypeRaw)
        .use(rehypeSanitize, { ...defaultSchema, ...rehypeSanitizeSchema })
        .use(rehypeKatex, {
          throwOnError: true,
          strict: false,
          errorColor: "inherit",
        })
        .use(rehypeExternalLinks, { target: "_blank", rel: ["nofollow"] })
        .use(rehypeHighlight, {
          detect: true,
          ignoreMissing: true,
          aliases: { xml: "vue" },
        })
        .use(rehypePlugins);
    });

    const parser = new SegmentedParser();

    const computedVNode = computed(() => {
      const children = parser.parse(props.source, computedProcessor.value);
      return toJsxRuntime({ type: "root", children } as any, {
        components: { ComponentCodeBlock, EchartCodeBlock, pre: CodeBlock },
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
  componentsMap?: Record<string, Component>;
  codeBlockRenderer?: Component;
  echartRenderer?: Component;
  echartRendererPlaceholder?: Component;
  extraLangs?: string[];
  rehypePlugins?: Plugin[];
  remarkPlugins?: Plugin[];
  remarkRehypeOptions?: RemarkRehypeOptions;
  remarkGfmOptions?: RemarkGfmOptions;
  rehypeSanitizeSchema?: Partial<Schema>;
}>;
