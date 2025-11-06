import { inject, provide } from "vue";
import type { Component } from "vue";

const configPropsKey = Symbol("configProps");

export interface ProxyProps {
  componentsMap?: Record<string, Component>;
  echartRenderer?: Component;
  echartRendererPlaceholder?: Component;
}

export function provideProxyProps(props: ProxyProps) {
  provide(configPropsKey, props);
}

export function useProxyProps() {
  return inject<ProxyProps>(configPropsKey)!;
}
