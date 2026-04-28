import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "@/lib/router";

interface MetricCardProps {
  icon: LucideIcon;
  value: string | number;
  label: string;
  description?: ReactNode;
  to?: string;
  onClick?: () => void;
}

export function MetricCard({ icon: Icon, value, label, description, to, onClick }: MetricCardProps) {
  const isClickable = !!(to || onClick);

  const inner = (
    <div className={`relative h-full px-4 py-4 sm:px-5 sm:py-5 rounded-lg overflow-hidden border border-border/40 transition-colors${isClickable ? " hover:bg-accent/50 cursor-pointer" : ""}`}>
      {/* Large background icon */}
      <Icon className="absolute h-20 w-20 text-muted-foreground/[0.07] pointer-events-none select-none" style={{ bottom: "-2px", right: "-2px" }} />
      <div className="relative z-10 flex-1 min-w-0">
        <p className="text-2xl sm:text-3xl font-semibold tracking-tight tabular-nums">
          {value}
        </p>
        <p className="text-xs sm:text-sm font-medium text-muted-foreground mt-1">
          {label}
        </p>
        {description && (
          <div className="text-xs text-muted-foreground/70 mt-1.5 hidden sm:block">{description}</div>
        )}
      </div>
    </div>
  );

  if (to) {
    return (
      <Link to={to} className="no-underline text-inherit h-full" onClick={onClick}>
        {inner}
      </Link>
    );
  }

  if (onClick) {
    return (
      <div className="h-full" onClick={onClick}>
        {inner}
      </div>
    );
  }

  return inner;
}
