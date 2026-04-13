import { VFile } from "vfile";
import type { Processor } from "unified";

/**
 * Split markdown source into top-level block segments at blank-line boundaries,
 * while correctly skipping blank lines that appear inside:
 *   - fenced code blocks  (``` / ~~~)
 *   - display math blocks ($$…$$)
 *   - HTML blocks         (<tag>…</tag> or <!-- … -->)
 *
 * Every completed segment (all but the last) is returned with a trailing "\n\n"
 * so that it parses correctly in isolation.
 */
export function splitIntoSegments(source: string): string[] {
  const lines = source.split("\n");
  const segments: string[] = [];

  let fenceMarker: string | null = null;
  let inMathBlock = false;
  let htmlBlockTag: string | null = null;
  let inHtmlComment = false;
  let currentLines: string[] = [];
  let pendingBlanks = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    const inBlock =
      fenceMarker !== null ||
      inMathBlock ||
      htmlBlockTag !== null ||
      inHtmlComment;

    if (trimmed === "") {
      inBlock ? currentLines.push(line) : pendingBlanks++;
      continue;
    }

    if (pendingBlanks > 0) {
      if (currentLines.length > 0) {
        segments.push(currentLines.join("\n") + "\n\n");
        currentLines = [];
      }
      pendingBlanks = 0;
    }

    currentLines.push(line);

    if (fenceMarker !== null) {
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
      if (trimmed === "$$") inMathBlock = false;
    } else if (inHtmlComment) {
      if (trimmed.includes("-->")) inHtmlComment = false;
    } else if (htmlBlockTag !== null) {
      if (new RegExp(`<\\/${htmlBlockTag}\\s*>`, "i").test(trimmed))
        htmlBlockTag = null;
    } else {
      const fenceOpen = trimmed.match(/^(`{3,}|~{3,})/);
      if (fenceOpen) {
        fenceMarker = fenceOpen[1];
      } else if (trimmed === "$$") {
        inMathBlock = true;
      } else if (trimmed.startsWith("<!--")) {
        if (!trimmed.includes("-->")) inHtmlComment = true;
      } else {
        const m = trimmed.match(/^<([a-zA-Z][a-zA-Z0-9-]*)(?:\s[^>]*)?\s*>/);
        if (m && !trimmed.match(/^<[a-zA-Z][a-zA-Z0-9-]*(?:\s[^>]*)?\s*\/>/)) {
          const tag = m[1].toLowerCase();
          if (
            !new RegExp(`<\\/${tag}\\s*>`, "i").test(trimmed.slice(m[0].length))
          ) {
            htmlBlockTag = tag;
          }
        }
      }
    }
  }

  if (currentLines.length > 0) {
    segments.push(currentLines.join("\n"));
  }

  return segments;
}

/**
 * Wraps a unified Processor with segment-level caching.
 * Completed (non-last) segments are parsed once and cached by text content.
 * The last segment is always re-parsed (streaming-friendly).
 * Cache is automatically invalidated when the processor instance changes.
 */
export class SegmentedParser {
  private processor: Processor<any, any, any, any, any> | null = null;
  private cache = new Map<string, any[]>();

  parse(source: string, processor: Processor<any, any, any, any, any>): any[] {
    if (this.processor !== processor) {
      this.processor = processor;
      this.cache.clear();
    }

    const segments = splitIntoSegments(source);
    const allChildren: any[] = [];
    const activeKeys = new Set<string>();

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      if (i < segments.length - 1) {
        if (!this.cache.has(seg)) {
          this.cache.set(seg, this.parseSegment(seg, processor));
        }
        allChildren.push(...this.cache.get(seg)!);
        activeKeys.add(seg);
      } else {
        allChildren.push(...this.parseSegment(seg, processor));
      }
    }

    // Evict stale cache entries
    for (const key of this.cache.keys()) {
      if (!activeKeys.has(key)) this.cache.delete(key);
    }

    return allChildren;
  }

  private parseSegment(
    source: string,
    processor: Processor<any, any, any, any, any>
  ): any[] {
    if (!source.trim()) return [];
    const file = new VFile();
    file.value = source;
    const tree = processor.runSync(processor.parse(file), file) as any;
    return tree.children ?? [];
  }
}
