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
import { VFile } from "vfile";
import { unified, type Plugin, type Processor } from "unified";
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

/**
 * Split markdown source into top-level block segments at blank-line boundaries,
 * while correctly skipping blank lines that appear inside:
 *   - fenced code blocks  (``` / ~~~)
 *   - display math blocks ($$…$$)
 *
 * Every completed segment (all but the last) is returned with a trailing "\n\n"
 * so that it parses correctly in isolation.
 */
function splitIntoSegments(source: string): string[] {
  const lines = source.split("\n");
  const segments: string[] = [];

  let fenceMarker: string | null = null; // e.g. "```" or "~~~"
  let inMathBlock = false;
  let currentLines: string[] = [];
  let pendingBlanks = 0; // number of consecutive blank lines outside a block

  for (const line of lines) {
    const trimmed = line.trim();

    // ── Blank line ──────────────────────────────────────────────────────────
    if (trimmed === "") {
      if (fenceMarker !== null || inMathBlock) {
        // Inside a block: blank lines belong to the current segment
        currentLines.push(line);
      } else {
        pendingBlanks++;
      }
      continue;
    }

    // ── Non-blank line ───────────────────────────────────────────────────────
    // Pending blanks signal a segment boundary (we were outside any block)
    if (pendingBlanks > 0) {
      if (currentLines.length > 0) {
        segments.push(currentLines.join("\n") + "\n\n");
        currentLines = [];
      }
      pendingBlanks = 0;
    }

    // ── State transitions ────────────────────────────────────────────────────
    if (fenceMarker !== null) {
      // Inside a fenced code block — look for the matching closing fence
      currentLines.push(line);
      const m = trimmed.match(/^(`{3,}|~{3,})/);
      if (
        m &&
        m[1][0] === fenceMarker[0] &&
        m[1].length >= fenceMarker.length &&
        trimmed.slice(m[1].length).trim() === ""
      ) {
        fenceMarker = null;
      }
    } else if (inMathBlock) {
      // Inside a display-math block — look for closing $$
      currentLines.push(line);
      if (trimmed === "$$") {
        inMathBlock = false;
      }
    } else {
      // Outside any block — check for opening fence or math
      const fenceOpen = trimmed.match(/^(`{3,}|~{3,})/);
      if (fenceOpen) {
        fenceMarker = fenceOpen[1];
      } else if (trimmed === "$$") {
        inMathBlock = true;
      }
      currentLines.push(line);
    }
  }

  // Flush any remaining content as the final (possibly incomplete) segment
  if (currentLines.length > 0) {
    segments.push(currentLines.join("\n"));
  }

  return segments;
}

/**
 * Run a single markdown segment through the full unified pipeline and return
 * the top-level hast children (block nodes) of the resulting root node.
 */
function parseSegment(
  source: string,
  processor: Processor<any, any, any, any, any>
): any[] {
  if (!source.trim()) return [];
  const file = new VFile();
  file.value = source;
  const tree = processor.runSync(processor.parse(file), file) as any;
  return tree.children ?? [];
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

    // Cache: segment text → hast children produced by that segment.
    // Keyed per-processor instance so that plugin/option changes auto-invalidate.
    let cacheProcessor: any = null;
    // Map<segmentText, hastChildren[]>
    const segmentCache = new Map<string, any[]>();

    const generateVueNode = (children: any[]) =>
      toJsxRuntime({ type: "root", children } as any, {
        components: { ComponentCodeBlock, EchartCodeBlock, pre: CodeBlock },
        Fragment,
        jsx,
        jsxs: jsx,
        passKeys: true,
        passNode: true,
      });

    const computedVNode = computed(() => {
      const processor = computedProcessor.value;
      const source = props.source;

      // Invalidate cache when the processor (plugins / options) changes
      if (cacheProcessor !== processor) {
        cacheProcessor = processor;
        segmentCache.clear();
      }

      const segments = splitIntoSegments(source);
      const allChildren: any[] = [];

      // Track which segment keys are still alive so we can evict stale entries
      const activeKeys = new Set<string>();

      for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        const isLast = i === segments.length - 1;

        if (!isLast) {
          // Completed segment: serve from cache or parse once and store
          if (!segmentCache.has(seg)) {
            segmentCache.set(seg, parseSegment(seg, processor));
          }
          allChildren.push(...segmentCache.get(seg)!);
          activeKeys.add(seg);
        } else {
          // Last (possibly still-streaming) segment: always re-parse, never cache
          allChildren.push(...parseSegment(seg, processor));
        }
      }

      // Evict cache entries whose segments are no longer present in the source
      for (const key of segmentCache.keys()) {
        if (!activeKeys.has(key)) {
          segmentCache.delete(key);
        }
      }

      return generateVueNode(allChildren);
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
