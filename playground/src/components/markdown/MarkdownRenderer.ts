import "katex/dist/katex.min.css";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";
import type { Plugin } from "unified";
import {
  BarChart,
  CodeBlockRenderer,
  EchartRenderer,
  MermaidRenderer,
  Placeholder,
  TableRenderer,
} from "./index.js";
import ARenderer from "./nodes/ARenderer.vue";
import CodeRender from "./nodes/CodeRender.vue";
import ImageRenderer from "./nodes/ImageRenderer.vue";
import PRender from "./nodes/PRender.vue";

export const nodeRenderers = {
  a: ARenderer,
  img: ImageRenderer,
  p: PRender,
  code: CodeRender,
};

export const componentsMap = {
  BarChart,
  Placeholder,
};

export const codeBlockRenderer = CodeBlockRenderer;

export const echartRenderer = EchartRenderer;

export const echartRendererPlaceholder = Placeholder;

export const mermaidRenderer = MermaidRenderer;

export const tableRenderer = TableRenderer;

export const remarkPlugins = [remarkMath];

export const rehypePlugins = [rehypeKatex as unknown as Plugin];
