import type { InjectionKey } from "vue";
import type { ResolvedRendererOptions } from "./apiOptions.js";

export const configPropsKey = Symbol("configProps");

export const markdownRendererOptionsKey =
  Symbol() as InjectionKey<ResolvedRendererOptions>;
