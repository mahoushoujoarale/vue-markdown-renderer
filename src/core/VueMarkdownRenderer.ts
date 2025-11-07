import {
  h,
  defineComponent,
  type PropType,
  computed,
  type Component,
} from "vue";
import { Fragment } from "vue/jsx-runtime";
import { toJsxRuntime } from "hast-util-to-jsx-runtime";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import remarkGfm, { Options as RemarkGfmOptions } from "remark-gfm";
import { VFile } from "vfile";
import { unified, type Plugin } from "unified";
import rehypeHighlight from "rehype-highlight";
import {
  remarkComponentCodeBlock,
  ComponentCodeBlock,
} from "./plugin/remarkComponentCodeBlock.js";
import {
  remarkEchartCodeBlock,
  EchartCodeBlock,
} from "./plugin/remarkEchartCodeBlock.js";
import { provideProxyProps } from "./useProxyProps.js";

interface RemarkRehypeOptions {
  allowDangerousHtml?: boolean;
  [key: string]: any;
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
      } = props;
      const processor = unified()
        .use(remarkParse)
        .use(remarkGfm, remarkGfmOptions)
        .use(remarkComponentCodeBlock)
        .use(remarkEchartCodeBlock)
        .use(remarkPlugins)
        .use(remarkRehype, remarkRehypeOptions)
        .use(rehypeHighlight, {
          detect: true,
          ignoreMissing: true,
          aliases: {
            xml: "vue",
          },
        })
        .use(rehypePlugins);
      return processor;
    });

    const createFile = (md: string) => {
      const file = new VFile();
      file.value = md;
      return file;
    };

    const generateVueNode = (tree: any) => {
      const vueVnode = toJsxRuntime(tree, {
        components: {
          ComponentCodeBlock,
          EchartCodeBlock,
        },
        Fragment,
        jsx: jsx,
        jsxs: jsx,
        passKeys: true,
        passNode: true,
      });
      return vueVnode;
    };

    const computedVNode = computed(() => {
      const processor = computedProcessor.value;
      const file = createFile(props.source);
      return generateVueNode(processor.runSync(processor.parse(file), file));
    });

    return () => {
      return computedVNode.value;
    };
  },
});
