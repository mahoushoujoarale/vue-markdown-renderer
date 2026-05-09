import type { Component } from "vue";

export interface ResolvedRendererOptions {
  renderers: {
    nodes: Record<string, Component>;
    components: Record<string, Component>;
    codeBlock?: Component;
    mermaid?: Component;
    echart?: {
      renderer: Component;
      placeholder?: Component;
    };
    table?: Component;
  };
}
