import type { TranscriptEntry } from "../types";

export function parseGitHubCopilotStdoutLine(line: string, ts: string): TranscriptEntry[] {
  return [{ kind: "stdout", ts, text: line }];
}
