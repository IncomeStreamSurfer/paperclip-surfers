import { cn } from "@/lib/utils";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

interface TooltipProps {
  children: ReactNode;
  content: string;
  className?: string;
  position?: "top" | "bottom" | "left" | "right";
}

export function Tooltip({ children, content, className, position = "top" }: TooltipProps) {
  const [show, setShow] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!show || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const GAP = 6;
    let top = 0;
    let left = 0;
    switch (position) {
      case "top":
        top = rect.top + window.scrollY - GAP;
        left = rect.left + window.scrollX + rect.width / 2;
        break;
      case "bottom":
        top = rect.bottom + window.scrollY + GAP;
        left = rect.left + window.scrollX + rect.width / 2;
        break;
      case "left":
        top = rect.top + window.scrollY + rect.height / 2;
        left = rect.left + window.scrollX - GAP;
        break;
      case "right":
        top = rect.top + window.scrollY + rect.height / 2;
        left = rect.right + window.scrollX + GAP;
        break;
    }
    setCoords({ top, left });
  }, [show, position]);

  const transformMap = {
    top: "translateX(-50%) translateY(-100%)",
    bottom: "translateX(-50%)",
    left: "translateX(-100%) translateY(-50%)",
    right: "translateY(-50%)",
  };

  return (
    <span
      ref={triggerRef}
      className={cn("relative inline-flex", className)}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      onFocus={() => setShow(true)}
      onBlur={() => setShow(false)}
    >
      {children}
      {show && createPortal(
        <span
          role="tooltip"
          className="fixed z-[9999] px-2 py-1 text-[11px] font-medium rounded-md whitespace-nowrap pointer-events-none bg-popover text-popover-foreground border border-border shadow-sm"
          style={{
            top: coords.top,
            left: coords.left,
            transform: transformMap[position],
          }}
        >
          {content}
        </span>,
        document.body,
      )}
    </span>
  );
}
