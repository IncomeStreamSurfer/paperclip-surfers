import type { TranscriptEntry } from "../types";

export function parseOpenRouterApiStdoutLine(line: string, ts: string): TranscriptEntry[] {
  return [{ kind: "stdout", ts, text: line }];
}
