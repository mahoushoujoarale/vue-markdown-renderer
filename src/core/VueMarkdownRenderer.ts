import {
  h,
  defineComponent,
  type PropType,
  computed,
  type Component,
  type DefineComponent,
  shallowRef,
  watch,
} from "vue";
import { Fragment } from "vue/jsx-runtime";
import { toJsxRuntime } from "hast-util-to-jsx-runtime";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import remarkGfm, { Options as RemarkGfmOptions } from "remark-gfm";
import { VFile } from "vfile";
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

interface RemarkRehypeOptions {
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

// 简单的 hash 函数
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString(36);
}

interface MarkdownSegment {
  content: string;
  isClosed: boolean;
  hash: string;
}

// 将 Markdown 按闭合块分段
function segmentMarkdown(source: string): MarkdownSegment[] {
  const segments: MarkdownSegment[] = [];
  const lines = source.split("\n");
  let buffer = "";
  let inCodeBlock = false;
  let codeBlockFence = "";
  let inList = false;
  let lastLineEmpty = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();
    const nextLine = i < lines.length - 1 ? lines[i + 1] : null;
    const nextLineTrimmed = nextLine?.trim() || "";

    // 检测代码块
    if (trimmedLine.startsWith("```") || trimmedLine.startsWith("~~~")) {
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeBlockFence = trimmedLine.startsWith("```") ? "```" : "~~~";
      } else if (trimmedLine.startsWith(codeBlockFence)) {
        inCodeBlock = false;
        buffer += line + "\n";
        // 代码块闭合，作为一个完整段落
        if (nextLineTrimmed === "" || nextLine === null) {
          segments.push({
            content: buffer,
            isClosed: true,
            hash: simpleHash(buffer),
          });
          buffer = "";
        }
        continue;
      }
    }

    buffer += line + "\n";

    // 在代码块内部，不做分段判断
    if (inCodeBlock) {
      continue;
    }

    // 检测列表
    const isListItem = /^[\s]*[-*+]\s/.test(line) || /^[\s]*\d+\.\s/.test(line);
    if (isListItem) {
      inList = true;
    }

    // 空行判断
    const isEmptyLine = trimmedLine === "";

    if (isEmptyLine) {
      // 连续两个空行或空行后没有内容了，表示段落闭合
      if (lastLineEmpty || nextLine === null) {
        if (buffer.trim()) {
          segments.push({
            content: buffer,
            isClosed: true,
            hash: simpleHash(buffer),
          });
          buffer = "";
        }
        inList = false;
      }
      lastLineEmpty = true;
    } else {
      // 非空行后跟空行，且不在列表中，表示段落可能闭合
      if (nextLineTrimmed === "" && !inList) {
        // 等待下一次循环确认
      } else if (nextLine === null) {
        // 最后一行，未闭合
        // 继续累积到 buffer
      }
      lastLineEmpty = false;
    }
  }

  // 处理剩余未闭合内容
  if (buffer.trim()) {
    segments.push({
      content: buffer,
      isClosed: false,
      hash: simpleHash(buffer),
    });
  }

  return segments;
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

    // 缓存：hash -> VNode
    const segmentCache = new Map<string, any>();
    // 上一次的 source，用于检测是否是增量追加
    let lastSource = "";

    const computedProcessor = computed(() => {
      const {
        rehypePlugins,
        remarkPlugins,
        remarkRehypeOptions,
        remarkGfmOptions,
        rehypeSanitizeSchema,
      } = props;

      const processor = unified()
        .use(remarkParse)
        .use(remarkGfm, remarkGfmOptions)
        .use(remarkComponentCodeBlock)
        .use(remarkEchartCodeBlock)
        .use(remarkMath)
        .use(remarkPlugins)
        .use(remarkRehype, remarkRehypeOptions)
        .use(rehypeRaw)
        .use(rehypeSanitize, {
          ...defaultSchema,
          ...rehypeSanitizeSchema,
          tagNames: [
            ...(defaultSchema.tagNames || []),
            "input",
            ...(rehypeSanitizeSchema?.tagNames || []),
          ],
          attributes: {
            ...defaultSchema.attributes,
            input: [
              ...(defaultSchema.attributes?.input || []),
              ["type", "checkbox"],
              ["checked"],
              ["disabled"],
            ],
            ...rehypeSanitizeSchema?.attributes,
          },
        })
        .use(rehypeKatex, {
          throwOnError: true,
          strict: false,
          errorColor: "inherit",
        })
        .use(rehypeExternalLinks, { target: "_blank", rel: ["nofollow"] })
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
          pre: CodeBlock,
        },
        Fragment,
        jsx: jsx,
        jsxs: jsx,
        passKeys: true,
        passNode: true,
      });
      return vueVnode;
    };

    const vnode = shallowRef<any>(null);

    watch(
      () => props.source,
      (newSource) => {
        const processor = computedProcessor.value;

        // 检测是否是完全替换（非增量追加）
        if (!newSource.startsWith(lastSource)) {
          // 内容完全替换，清空缓存
          segmentCache.clear();
        }
        lastSource = newSource;

        // 分段处理
        const segments = segmentMarkdown(newSource);
        const vnodes: any[] = [];

        for (let i = 0; i < segments.length; i++) {
          const segment = segments[i];

          // 如果段落已闭合且已缓存，直接使用缓存
          if (segment.isClosed && segmentCache.has(segment.hash)) {
            vnodes.push(segmentCache.get(segment.hash));
          } else {
            // 未闭合或未缓存，需要处理
            const file = createFile(segment.content);
            const tree = processor.runSync(processor.parse(file), file);
            const segmentVNode = generateVueNode(tree);

            // 如果段落已闭合，加入缓存
            if (segment.isClosed) {
              segmentCache.set(segment.hash, segmentVNode);
            }

            vnodes.push(segmentVNode);
          }
        }

        // 合并所有段落的 VNode
        vnode.value = h(Fragment, {}, vnodes);
      },
      { immediate: true }
    );

    return () => {
      return vnode.value;
    };
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
