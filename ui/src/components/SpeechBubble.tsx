import { Loader2 } from "lucide-react";

export function SpeechBubble({ text, thinking }: { text: string; thinking?: boolean }) {
  return (
    <div className="animate-bubble-in pointer-events-none absolute bottom-[calc(100%+6px)] left-1/2 z-30 w-max max-w-[220px] -translate-x-1/2">
      <div className="relative rounded-2xl border-2 border-border bg-popover px-3 py-2 text-[11px] leading-snug shadow-lg">
        {thinking ? (
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span className="italic">{text}</span>
          </span>
        ) : (
          <span className="text-foreground">{text}</span>
        )}
      </div>
      <svg
        className="absolute left-1/2 -translate-x-1/2 h-2.5 w-4"
        style={{ top: "100%" }}
        viewBox="0 0 16 10"
        fill="none"
      >
        <path d="M8 10L0 0h16L8 10z" className="fill-popover stroke-border" strokeWidth="2" strokeLinejoin="round" />
      </svg>
    </div>
  );
}
