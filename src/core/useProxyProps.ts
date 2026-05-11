import { inject, provide } from "vue";
import type { Component } from "vue";
import { configPropsKey } from "./symbol.js";

export interface ProxyProps {
  componentsMap?: Record<string, Component>;
  echartRenderer?: Component;
  echartRendererPlaceholder?: Component;
  componentRendererPlaceholder?: Component;
  mermaidRendererPlaceholder?: Component;
  codeBlockRenderer?: Component;
}

export function provideProxyProps(props: ProxyProps) {
  provide(configPropsKey, props);
}

export function useProxyProps() {
  return inject<ProxyProps>(configPropsKey)!;
}
