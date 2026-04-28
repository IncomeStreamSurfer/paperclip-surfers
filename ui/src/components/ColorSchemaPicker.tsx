import type { CSSProperties } from "react";
import { useState, useEffect } from "react";
import { useColorSchema, PREDEFINED_SCHEMAS, type ColorTokens } from "../context/ColorSchemaContext";
import { Check } from "lucide-react";

const TOKEN_LABELS: Record<keyof ColorTokens, string> = {
  primary: "Primary",
  primaryForeground: "Primary text",
  accent: "Accent",
  accentForeground: "Accent text",
  ring: "Focus ring",
  sidebarPrimary: "Sidebar primary",
  sidebarAccent: "Sidebar accent",
};

// Produce a representative hex swatch color from an oklch string for the preview dot.
// We can't render oklch in an HTML color input, so we use it only as a style.
function swatchStyle(color: string): CSSProperties {
  return { backgroundColor: color };
}

/**
 * Convert any valid CSS color string to a #rrggbb hex value using the browser's
 * built-in color parser (via canvas). This handles oklch, hsl, rgb, named colors, etc.
 */
function cssColorToHex(color: string): string {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const ctx = canvas.getContext("2d");
    if (!ctx) return "#000000";
    // Reset to black first so invalid colors fall back cleanly
    ctx.fillStyle = "#000000";
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 1, 1);
    const d = ctx.getImageData(0, 0, 1, 1).data;
    return (
      "#" +
      (d[0] ?? 0).toString(16).padStart(2, "0") +
      (d[1] ?? 0).toString(16).padStart(2, "0") +
      (d[2] ?? 0).toString(16).padStart(2, "0")
    );
  } catch {
    return "#000000";
  }
}

/**
 * A controlled hex text input that:
 * - Displays the hex equivalent of any CSS color (oklch, hsl, rgb, #hex, etc.)
 * - Lets the user edit freely, committing on Enter or blur
 * - Validates that the committed value is a valid 6-digit hex color
 */
function HexColorInput({
  cssColor,
  onCommit,
}: {
  cssColor: string;
  onCommit: (hex: string) => void;
}) {
  const asHex = cssColorToHex(cssColor);
  const [draft, setDraft] = useState(asHex);

  // Keep in sync when the parent value changes (e.g. swatch pick)
  useEffect(() => {
    setDraft(cssColorToHex(cssColor));
  }, [cssColor]);

  const commit = (raw: string) => {
    const normalized = raw.trim().replace(/^#?/, "#");
    if (/^#[0-9a-fA-F]{6}$/.test(normalized)) {
      onCommit(normalized.toLowerCase());
      setDraft(normalized.toLowerCase());
    } else {
      // Revert to current hex on invalid input
      setDraft(cssColorToHex(cssColor));
    }
  };

  return (
    <input
      type="text"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => commit(draft)}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit(draft);
      }}
      placeholder="#000000"
      maxLength={7}
      className="w-28 rounded-md border border-border bg-background px-2 py-1 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-ring"
    />
  );
}

export function ColorSchemaPicker() {
  const { schemaId, custom, setSchemaId, setCustomToken } = useColorSchema();

  return (
    <div className="space-y-4">
      {/* Predefined schema grid */}
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {PREDEFINED_SCHEMAS.map((schema) => {
          const isSelected = schemaId === schema.id;
          return (
            <button
              key={schema.id}
              onClick={() => setSchemaId(schema.id as Parameters<typeof setSchemaId>[0])}
              className={`relative flex flex-col items-center gap-1.5 rounded-md border p-2 text-xs transition-colors hover:bg-muted ${
                isSelected ? "border-primary ring-1 ring-primary" : "border-border"
              }`}
            >
              {/* Color swatch preview */}
              <div className="flex gap-0.5">
                <div
                  className="h-4 w-4 rounded-full border border-border/50"
                  style={swatchStyle(schema.light.primary)}
                />
                <div
                  className="h-4 w-4 rounded-full border border-border/50"
                  style={swatchStyle(schema.light.accent)}
                />
              </div>
              <span className="font-medium">{schema.name}</span>
              {isSelected && (
                <span className="absolute right-1 top-1 text-primary">
                  <Check className="h-3 w-3" />
                </span>
              )}
            </button>
          );
        })}

        {/* Custom option */}
        <button
          onClick={() => setSchemaId("custom")}
          className={`relative flex flex-col items-center gap-1.5 rounded-md border p-2 text-xs transition-colors hover:bg-muted ${
            schemaId === "custom" ? "border-primary ring-1 ring-primary" : "border-border"
          }`}
        >
          <div className="flex gap-0.5">
            <div className="h-4 w-4 rounded-full border border-dashed border-muted-foreground bg-gradient-to-br from-violet-400 to-orange-400" />
            <div className="h-4 w-4 rounded-full border border-dashed border-muted-foreground bg-gradient-to-br from-blue-400 to-green-400" />
          </div>
          <span className="font-medium">Custom</span>
          {schemaId === "custom" && (
            <span className="absolute right-1 top-1 text-primary">
              <Check className="h-3 w-3" />
            </span>
          )}
        </button>
      </div>

      {/* Custom token editor — only shown when custom is selected */}
      {schemaId === "custom" && (
        <div className="rounded-md border border-border p-4 space-y-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Custom colors
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {(Object.keys(TOKEN_LABELS) as (keyof ColorTokens)[]).map((key) => (
              <div key={key} className="flex items-center gap-2">
                <label className="flex-1 text-sm text-muted-foreground">
                  {TOKEN_LABELS[key]}
                </label>

                {/*
                  Native color picker: a visible swatch square overlaid with a
                  transparent <input type="color"> that triggers the OS picker.
                  cssColorToHex converts oklch/hsl/etc. → hex for the input value.
                */}
                <div className="relative h-6 w-6 flex-shrink-0 cursor-pointer overflow-hidden rounded border border-border">
                  <div className="absolute inset-0" style={{ backgroundColor: custom[key] }} />
                  <input
                    type="color"
                    value={cssColorToHex(custom[key])}
                    onChange={(e) => setCustomToken(key, e.target.value)}
                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                    title={`Pick ${TOKEN_LABELS[key]}`}
                  />
                </div>

                <HexColorInput
                  cssColor={custom[key]}
                  onCommit={(hex) => setCustomToken(key, hex)}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
