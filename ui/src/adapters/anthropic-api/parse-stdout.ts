import type { TranscriptEntry } from "../types";

export function parseAnthropicApiStdoutLine(line: string, ts: string): TranscriptEntry[] {
  return [{ kind: "stdout", ts, text: line }];
}
