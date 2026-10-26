/**
 * ripgrep's --json messages for one searched file: `begin`, the matching
 * lines with their submatches and the context lines around them, then `end`.
 *
 * As in ripgrep, offsets count UTF-8 bytes, matches that share a line are one
 * message, and a match that spans lines (-U) is one message holding every
 * line it touches.
 */

import { utf8ByteLength } from "../../encoding.js";
import {
  ExecutionAbortedError,
  ExecutionLimitError,
} from "../../interpreter/errors.js";
import type { UserRegex } from "../../regex/index.js";

export interface JsonSearchOptions {
  invertMatch: boolean;
  multiline: boolean;
  beforeContext: number;
  afterContext: number;
  /** Stop after this many matching messages (0 = no limit). */
  maxCount: number;
  replace: string | null;
  /** Maximum synchronous matching work units. */
  maxWork?: number;
  /** Maximum retained matches and messages. */
  maxMatches?: number;
  signal?: AbortSignal;
}

export interface JsonFileResult {
  messages: string[];
  matchedLines: number;
  matches: number;
}

interface JsonSubmatch {
  match: { text: string };
  start: number;
  end: number;
  replacement?: { text: string };
}

/** Selected lines `first`..`last` and the matches in them, as offsets into the file. */
interface Selection {
  first: number;
  last: number;
  spans: Array<[start: number, end: number]>;
}

export function jsonFileMessages(
  file: string,
  content: string,
  regex: UserRegex,
  options: JsonSearchOptions,
): JsonFileResult {
  const { beforeContext, afterContext, maxCount, maxWork, maxMatches } =
    options;
  let work = 0;
  const chargeWork = (): void => {
    if (options.signal?.aborted) throw new ExecutionAbortedError();
    if (maxWork !== undefined && ++work > maxWork) {
      throw new ExecutionLimitError(
        `rg: matching work limit exceeded (${maxWork})`,
        "iterations",
      );
    }
  };
  const retain = <T>(list: T[], value: T): void => {
    if (maxMatches !== undefined && list.length >= maxMatches) {
      throw new ExecutionLimitError(
        `rg: match limit exceeded (${maxMatches})`,
        "array_elements",
      );
    }
    list.push(value);
  };

  // Line starts as character offsets; a final newline ends the last line
  // rather than starting an empty one.
  const starts = [0];
  for (let i = 0; i < content.length; i++) {
    if ((i & 1023) === 0) chargeWork();
    if (content.charCodeAt(i) === 10 && i + 1 < content.length) {
      retain(starts, i + 1);
    }
  }
  const lineCount = content.length === 0 ? 0 : starts.length;
  const lineEnd = (line: number): number =>
    line + 1 < starts.length ? starts[line + 1] : content.length;
  const lineAt = (offset: number): number => {
    let low = 0;
    let high = starts.length - 1;
    while (low < high) {
      const middle = (low + high + 1) >> 1;
      if (starts[middle] <= offset) low = middle;
      else high = middle - 1;
    }
    return low;
  };
  // A line's text without its terminator, for single-line matching.
  const lineText = (line: number): string => {
    const end = lineEnd(line);
    return content.slice(
      starts[line],
      content.charCodeAt(end - 1) === 10 ? end - 1 : end,
    );
  };

  const selections: Selection[] = [];
  const full = (): boolean => maxCount > 0 && selections.length >= maxCount;

  if (options.multiline) {
    // The lines matches cover: selected as they are, or skipped with -v.
    const covered: Selection[] = options.invertMatch ? [] : selections;
    regex.lastIndex = 0;
    for (
      let match = regex.exec(content);
      match !== null;
      match = regex.exec(content)
    ) {
      chargeWork();
      const start = match.index;
      const end = start + match[0].length;
      const first = lineAt(start);
      const last = lineAt(Math.max(start, end - 1));
      const previous = covered[covered.length - 1];
      if (previous && first <= previous.last) {
        previous.last = Math.max(previous.last, last);
        retain(previous.spans, [start, end]);
      } else {
        if (
          !options.invertMatch &&
          maxCount > 0 &&
          covered.length >= maxCount
        ) {
          break;
        }
        retain(covered, { first, last, spans: [[start, end]] });
      }
      if (match[0].length === 0) regex.lastIndex++;
    }
    if (options.invertMatch) {
      let next = 0;
      for (let line = 0; line < lineCount && !full(); line++) {
        chargeWork();
        while (next < covered.length && covered[next].last < line) next++;
        if (next < covered.length && covered[next].first <= line) continue;
        retain(selections, { first: line, last: line, spans: [] });
      }
    }
  } else {
    for (let line = 0; line < lineCount && !full(); line++) {
      chargeWork();
      const text = lineText(line);
      const spans: Selection["spans"] = [];
      regex.lastIndex = 0;
      for (
        let match = regex.exec(text);
        match !== null;
        match = regex.exec(text)
      ) {
        chargeWork();
        const start = starts[line] + match.index;
        retain(spans, [start, start + match[0].length]);
        if (options.invertMatch) break;
        if (match[0].length === 0) regex.lastIndex++;
      }
      if (spans.length > 0 !== options.invertMatch) {
        retain(selections, {
          first: line,
          last: line,
          spans: options.invertMatch ? [] : spans,
        });
      }
    }
  }

  // Byte offset of each line start, filled in as lines are reported.
  const byteStarts = [0];
  const byteStart = (line: number): number => {
    for (let known = byteStarts.length; known <= line; known++) {
      chargeWork();
      byteStarts.push(
        byteStarts[known - 1] +
          utf8ByteLength(content.slice(starts[known - 1], starts[known])),
      );
    }
    return byteStarts[line];
  };

  const messages: string[] = [];
  const path = { text: file };
  const report = (
    type: "match" | "context",
    first: number,
    last: number,
    spans: Selection["spans"],
  ): void => {
    const begin = starts[first];
    const submatches: JsonSubmatch[] = spans.map(([start, end]) => {
      const offset = utf8ByteLength(content.slice(begin, start));
      const submatch: JsonSubmatch = {
        match: { text: content.slice(start, end) },
        start: offset,
        end: offset + utf8ByteLength(content.slice(start, end)),
      };
      if (options.replace !== null) {
        submatch.replacement = { text: options.replace };
      }
      return submatch;
    });
    retain(
      messages,
      JSON.stringify({
        type,
        data: {
          path,
          lines: { text: content.slice(begin, lineEnd(last)) },
          line_number: first + 1,
          absolute_offset: byteStart(first),
          submatches,
        },
      }),
    );
  };

  messages.push(JSON.stringify({ type: "begin", data: { path } }));
  let reported = -1;
  let matchedLines = 0;
  let matches = 0;
  for (let i = 0; i < selections.length; i++) {
    const { first, last, spans } = selections[i];
    for (
      let line = Math.max(reported + 1, first - beforeContext);
      line < first;
      line++
    ) {
      report("context", line, line, []);
    }
    report("match", first, last, spans);
    matchedLines += last - first + 1;
    matches += spans.length;
    const nextFirst =
      i + 1 < selections.length ? selections[i + 1].first : lineCount;
    const after = Math.min(last + afterContext, nextFirst - 1, lineCount - 1);
    for (let line = last + 1; line <= after; line++) {
      report("context", line, line, []);
    }
    reported = Math.max(last, after);
  }
  messages.push(
    JSON.stringify({
      type: "end",
      data: {
        path,
        binary_offset: null,
        stats: {
          elapsed: { secs: 0, nanos: 0, human: "0s" },
          searches: 1,
          searches_with_match: 1,
          bytes_searched: utf8ByteLength(content),
          bytes_printed: 0,
          matched_lines: matchedLines,
          matches,
        },
      },
    }),
  );

  return { messages, matchedLines, matches };
}
