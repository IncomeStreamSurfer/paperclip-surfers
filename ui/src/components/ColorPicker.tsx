import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

interface ColorPickerProps {
  value: string;
  onChange: (hex: string) => void;
  className?: string;
}

/**
 * Inline color picker: a colored swatch (clicking opens the OS color dialog)
 * paired with a hex text input that commits on Enter or blur.
 */
export function ColorPicker({ value, onChange, className }: ColorPickerProps) {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  const commit = (raw: string) => {
    const normalized = raw.trim().replace(/^#?/, "#");
    if (/^#[0-9a-fA-F]{6}$/.test(normalized)) {
      onChange(normalized.toLowerCase());
      setDraft(normalized.toLowerCase());
    }
  };

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      {/* Swatch — clicking opens the native OS color picker */}
      <label
        className="relative h-6 w-6 shrink-0 rounded cursor-pointer border border-border overflow-hidden"
        style={{ backgroundColor: value }}
        title="Pick color"
      >
        <input
          type="color"
          className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setDraft(e.target.value);
          }}
        />
      </label>
      {/* Hex text input */}
      <input
        type="text"
        className="w-[4.5rem] px-1.5 py-0.5 text-xs rounded border border-border bg-transparent outline-none focus:border-primary font-mono"
        value={draft}
        placeholder="#000000"
        maxLength={7}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => commit(draft)}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit(draft);
        }}
      />
    </div>
  );
}
