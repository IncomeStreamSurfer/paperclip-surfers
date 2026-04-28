import { useEffect, useState, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { useSidebar } from "../context/SidebarContext";
import { cn } from "../lib/utils";

interface SidebarSectionProps {
  label: string;
  children: ReactNode;
  defaultExpanded?: boolean;
}

function storageKey(label: string) {
  return `sidebar-section:${label.toLowerCase().replace(/\s+/g, "-")}`;
}

function readStored(label: string, fallback: boolean): boolean {
  try {
    const v = localStorage.getItem(storageKey(label));
    return v !== null ? v === "true" : fallback;
  } catch {
    return fallback;
  }
}

function writeStored(label: string, value: boolean) {
  try {
    localStorage.setItem(storageKey(label), String(value));
  } catch {}
}

export function SidebarSection({ label, children, defaultExpanded = true }: SidebarSectionProps) {
  const [expanded, setExpanded] = useState(() => readStored(label, defaultExpanded));
  const { forcedSectionState } = useSidebar();

  useEffect(() => {
    if (forcedSectionState !== null) {
      setExpanded(forcedSectionState.expanded);
      writeStored(label, forcedSectionState.expanded);
    }
  }, [forcedSectionState, label]);

  function toggle() {
    const next = !expanded;
    setExpanded(next);
    writeStored(label, next);
  }

  return (
    <div className="group">
      <button
        onClick={toggle}
        className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-medium uppercase tracking-widest font-mono text-foreground/50 hover:text-foreground/80 w-full transition-colors"
      >
        <ChevronRight
          className={cn(
            "h-3 w-3 text-foreground/40 transition-transform opacity-60 group-hover:opacity-100",
            expanded && "rotate-90",
          )}
        />
        {label}
      </button>
      {expanded && (
        <div className="flex flex-col gap-0.5 mt-0.5">{children}</div>
      )}
    </div>
  );
}
