import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export interface ColorTokens {
  primary: string;
  primaryForeground: string;
  accent: string;
  accentForeground: string;
  ring: string;
  sidebarPrimary: string;
  sidebarAccent: string;
}

export interface ColorSchema {
  id: string;
  name: string;
  light: ColorTokens;
  dark: ColorTokens;
  // Whether this theme should also change background colors
  hasDarkBackground?: boolean;
  hasLightBackground?: boolean;
}

// Predefined schemas — each one overrides only the primary/accent/ring family.
// Other tokens remain at the defaults defined in index.css.
export const PREDEFINED_SCHEMAS: ColorSchema[] = [
  {
    id: "light",
    name: "Light",
    light: {
      primary: "oklch(0.205 0 0)",
      primaryForeground: "oklch(0.985 0 0)",
      accent: "oklch(0.97 0 0)",
      accentForeground: "oklch(0.205 0 0)",
      ring: "oklch(0.708 0 0)",
      sidebarPrimary: "oklch(0.205 0 0)",
      sidebarAccent: "oklch(0.97 0 0)",
    },
    dark: {
      primary: "oklch(0.205 0 0)",
      primaryForeground: "oklch(0.985 0 0)",
      accent: "oklch(0.97 0 0)",
      accentForeground: "oklch(0.205 0 0)",
      ring: "oklch(0.708 0 0)",
      sidebarPrimary: "oklch(0.205 0 0)",
      sidebarAccent: "oklch(0.97 0 0)",
    },
  },
  {
    id: "dark",
    name: "Dark",
    light: {
      primary: "oklch(0.985 0 0)",
      primaryForeground: "oklch(0.205 0 0)",
      accent: "oklch(0.269 0 0)",
      accentForeground: "oklch(0.985 0 0)",
      ring: "oklch(0.439 0 0)",
      sidebarPrimary: "oklch(0.985 0 0)",
      sidebarAccent: "oklch(0.269 0 0)",
    },
    dark: {
      primary: "oklch(0.985 0 0)",
      primaryForeground: "oklch(0.205 0 0)",
      accent: "oklch(0.269 0 0)",
      accentForeground: "oklch(0.985 0 0)",
      ring: "oklch(0.439 0 0)",
      sidebarPrimary: "oklch(0.985 0 0)",
      sidebarAccent: "oklch(0.269 0 0)",
    },
  },
  {
    id: "default",
    name: "Ocean",
    light: {
      primary: "oklch(0.45 0.18 240)",
      primaryForeground: "oklch(0.98 0 0)",
      accent: "oklch(0.92 0.05 240)",
      accentForeground: "oklch(0.3 0.12 240)",
      ring: "oklch(0.6 0.14 240)",
      sidebarPrimary: "oklch(0.45 0.18 240)",
      sidebarAccent: "oklch(0.92 0.05 240)",
    },
    dark: {
      primary: "oklch(0.72 0.14 240)",
      primaryForeground: "oklch(0.12 0.05 240)",
      accent: "oklch(0.28 0.06 240)",
      accentForeground: "oklch(0.85 0.08 240)",
      ring: "oklch(0.55 0.12 240)",
      sidebarPrimary: "oklch(0.72 0.14 240)",
      sidebarAccent: "oklch(0.28 0.06 240)",
    },
  },
  {
    id: "midnight",
    name: "Midnight",
    light: {
      primary: "oklch(0.40 0.22 265)",
      primaryForeground: "oklch(0.98 0 0)",
      accent: "oklch(0.93 0.04 265)",
      accentForeground: "oklch(0.28 0.15 265)",
      ring: "oklch(0.58 0.17 265)",
      sidebarPrimary: "oklch(0.40 0.22 265)",
      sidebarAccent: "oklch(0.93 0.04 265)",
    },
    dark: {
      primary: "oklch(0.70 0.20 265)",
      primaryForeground: "oklch(0.10 0.05 265)",
      accent: "oklch(0.26 0.08 265)",
      accentForeground: "oklch(0.84 0.10 265)",
      ring: "oklch(0.54 0.16 265)",
      sidebarPrimary: "oklch(0.70 0.20 265)",
      sidebarAccent: "oklch(0.26 0.08 265)",
    },
  },
  {
    id: "forest",
    name: "Forest",
    light: {
      primary: "oklch(0.42 0.14 145)",
      primaryForeground: "oklch(0.98 0 0)",
      accent: "oklch(0.92 0.04 145)",
      accentForeground: "oklch(0.28 0.1 145)",
      ring: "oklch(0.58 0.11 145)",
      sidebarPrimary: "oklch(0.42 0.14 145)",
      sidebarAccent: "oklch(0.92 0.04 145)",
    },
    dark: {
      primary: "oklch(0.68 0.13 145)",
      primaryForeground: "oklch(0.12 0.04 145)",
      accent: "oklch(0.26 0.05 145)",
      accentForeground: "oklch(0.82 0.07 145)",
      ring: "oklch(0.52 0.1 145)",
      sidebarPrimary: "oklch(0.68 0.13 145)",
      sidebarAccent: "oklch(0.26 0.05 145)",
    },
  },
  {
    id: "sunset",
    name: "Sunset",
    light: {
      primary: "oklch(0.55 0.2 40)",
      primaryForeground: "oklch(0.98 0 0)",
      accent: "oklch(0.94 0.06 40)",
      accentForeground: "oklch(0.35 0.14 40)",
      ring: "oklch(0.65 0.16 40)",
      sidebarPrimary: "oklch(0.55 0.2 40)",
      sidebarAccent: "oklch(0.94 0.06 40)",
    },
    dark: {
      primary: "oklch(0.75 0.17 40)",
      primaryForeground: "oklch(0.14 0.05 40)",
      accent: "oklch(0.3 0.07 40)",
      accentForeground: "oklch(0.88 0.09 40)",
      ring: "oklch(0.6 0.14 40)",
      sidebarPrimary: "oklch(0.75 0.17 40)",
      sidebarAccent: "oklch(0.3 0.07 40)",
    },
  },
  {
    id: "violet",
    name: "Violet",
    light: {
      primary: "oklch(0.48 0.22 280)",
      primaryForeground: "oklch(0.98 0 0)",
      accent: "oklch(0.93 0.05 280)",
      accentForeground: "oklch(0.32 0.15 280)",
      ring: "oklch(0.62 0.18 280)",
      sidebarPrimary: "oklch(0.48 0.22 280)",
      sidebarAccent: "oklch(0.93 0.05 280)",
    },
    dark: {
      primary: "oklch(0.73 0.18 280)",
      primaryForeground: "oklch(0.12 0.05 280)",
      accent: "oklch(0.28 0.07 280)",
      accentForeground: "oklch(0.86 0.1 280)",
      ring: "oklch(0.57 0.15 280)",
      sidebarPrimary: "oklch(0.73 0.18 280)",
      sidebarAccent: "oklch(0.28 0.07 280)",
    },
  },
  {
    id: "rose",
    name: "Rose",
    light: {
      primary: "oklch(0.52 0.22 10)",
      primaryForeground: "oklch(0.98 0 0)",
      accent: "oklch(0.94 0.05 10)",
      accentForeground: "oklch(0.35 0.15 10)",
      ring: "oklch(0.64 0.18 10)",
      sidebarPrimary: "oklch(0.52 0.22 10)",
      sidebarAccent: "oklch(0.94 0.05 10)",
    },
    dark: {
      primary: "oklch(0.74 0.18 10)",
      primaryForeground: "oklch(0.13 0.05 10)",
      accent: "oklch(0.29 0.07 10)",
      accentForeground: "oklch(0.87 0.09 10)",
      ring: "oklch(0.58 0.15 10)",
      sidebarPrimary: "oklch(0.74 0.18 10)",
      sidebarAccent: "oklch(0.29 0.07 10)",
    },
  },
  {
    id: "teal",
    name: "Teal",
    light: {
      primary: "oklch(0.44 0.16 185)",
      primaryForeground: "oklch(0.98 0 0)",
      accent: "oklch(0.93 0.04 185)",
      accentForeground: "oklch(0.29 0.10 185)",
      ring: "oklch(0.60 0.13 185)",
      sidebarPrimary: "oklch(0.44 0.16 185)",
      sidebarAccent: "oklch(0.93 0.04 185)",
    },
    dark: {
      primary: "oklch(0.70 0.14 185)",
      primaryForeground: "oklch(0.11 0.04 185)",
      accent: "oklch(0.27 0.06 185)",
      accentForeground: "oklch(0.83 0.08 185)",
      ring: "oklch(0.54 0.12 185)",
      sidebarPrimary: "oklch(0.70 0.14 185)",
      sidebarAccent: "oklch(0.27 0.06 185)",
    },
  },
  {
    id: "amber",
    name: "Amber",
    light: {
      primary: "oklch(0.56 0.18 65)",
      primaryForeground: "oklch(0.13 0.04 65)",
      accent: "oklch(0.95 0.05 65)",
      accentForeground: "oklch(0.36 0.13 65)",
      ring: "oklch(0.68 0.15 65)",
      sidebarPrimary: "oklch(0.56 0.18 65)",
      sidebarAccent: "oklch(0.95 0.05 65)",
    },
    dark: {
      primary: "oklch(0.78 0.16 65)",
      primaryForeground: "oklch(0.14 0.05 65)",
      accent: "oklch(0.32 0.07 65)",
      accentForeground: "oklch(0.88 0.09 65)",
      ring: "oklch(0.62 0.13 65)",
      sidebarPrimary: "oklch(0.78 0.16 65)",
      sidebarAccent: "oklch(0.32 0.07 65)",
    },
  },
  {
    id: "slate",
    name: "Slate",
    light: {
      primary: "oklch(0.40 0.08 220)",
      primaryForeground: "oklch(0.98 0 0)",
      accent: "oklch(0.94 0.02 220)",
      accentForeground: "oklch(0.28 0.06 220)",
      ring: "oklch(0.55 0.06 220)",
      sidebarPrimary: "oklch(0.40 0.08 220)",
      sidebarAccent: "oklch(0.94 0.02 220)",
    },
    dark: {
      primary: "oklch(0.68 0.07 220)",
      primaryForeground: "oklch(0.12 0.03 220)",
      accent: "oklch(0.28 0.04 220)",
      accentForeground: "oklch(0.82 0.05 220)",
      ring: "oklch(0.52 0.05 220)",
      sidebarPrimary: "oklch(0.68 0.07 220)",
      sidebarAccent: "oklch(0.28 0.04 220)",
    },
  },
];

export type ColorSchemaId = (typeof PREDEFINED_SCHEMAS)[number]["id"] | "custom";

export interface ColorSchemaState {
  schemaId: ColorSchemaId;
  custom: ColorTokens;
}

const DEFAULT_CUSTOM: ColorTokens = { ...PREDEFINED_SCHEMAS[0]!.light };

const SCHEMA_STORAGE_KEY = "paperclip.color-schema";
const STYLE_ELEMENT_ID = "paperclip-color-schema";

function loadStoredState(): ColorSchemaState {
  try {
    const raw = localStorage.getItem(SCHEMA_STORAGE_KEY);
    if (raw) {
      const state = JSON.parse(raw) as ColorSchemaState;
      // Sync document class with stored theme
      if (state.schemaId === "light") {
        document.documentElement.classList.remove("dark");
        document.documentElement.classList.add("light");
      } else if (state.schemaId === "dark") {
        document.documentElement.classList.remove("light");
        document.documentElement.classList.add("dark");
      }
      return state;
    }
  } catch { /* ignore */ }
  // Default to dark mode if no stored preference
  document.documentElement.classList.remove("light");
  document.documentElement.classList.add("dark");
  return { schemaId: "dark", custom: DEFAULT_CUSTOM };
}

function buildStyleContent(lightTokens: ColorTokens, darkTokens: ColorTokens, isDark: boolean): string {
  const vars = (t: ColorTokens) => `
  --primary: ${t.primary};
  --primary-foreground: ${t.primaryForeground};
  --accent: ${t.accent};
  --accent-foreground: ${t.accentForeground};
  --ring: ${t.ring};
  --sidebar-primary: ${t.sidebarPrimary};
  --sidebar-accent: ${t.sidebarAccent};
  --sidebar-primary-foreground: ${t.primaryForeground};
  --sidebar-accent-foreground: ${t.accentForeground};`;
  return `:root { ${vars(lightTokens)} }\n:root.dark { ${vars(darkTokens)} }\n:root.light { ${vars(lightTokens)} }`;
}

function applySchema(state: ColorSchemaState, isDark: boolean) {
  const schema = PREDEFINED_SCHEMAS.find((s) => s.id === state.schemaId);
  const fallback = PREDEFINED_SCHEMAS[0]!;
  const lightTokens = state.schemaId === "custom" ? state.custom : (schema?.light ?? fallback.light);
  const darkTokens  = state.schemaId === "custom" ? state.custom : (schema?.dark ?? fallback.dark);

  let el = document.getElementById(STYLE_ELEMENT_ID);
  if (!el) {
    el = document.createElement("style");
    el.id = STYLE_ELEMENT_ID;
    document.head.appendChild(el);
  }
  el.textContent = buildStyleContent(lightTokens, darkTokens, isDark);
}

interface ColorSchemaContextValue {
  schemaId: ColorSchemaId;
  custom: ColorTokens;
  setSchemaId: (id: ColorSchemaId) => void;
  setCustomToken: (key: keyof ColorTokens, value: string) => void;
  currentTokens: ColorTokens;
  toggleDarkMode: () => void;
}

const ColorSchemaContext = createContext<ColorSchemaContextValue | undefined>(undefined);

export function ColorSchemaProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ColorSchemaState>(loadStoredState);
  
  // Determine theme from document class
  const theme = typeof window !== "undefined" && document.documentElement.classList.contains("dark") ? "dark" : "light";

  const setSchemaId = useCallback((id: ColorSchemaId) => {
    setState((prev) => {
      if (id === "custom") {
        // Seed custom from the currently active predefined schema's light tokens
        const currentSchema = PREDEFINED_SCHEMAS.find((s) => s.id === prev.schemaId);
        const seedTokens = currentSchema ? currentSchema.light : DEFAULT_CUSTOM;
        return { schemaId: "custom", custom: { ...seedTokens } };
      }
      return { ...prev, schemaId: id };
    });
    
    // If selecting "light" or "dark", also toggle the document class
    if (id === "light") {
      document.documentElement.classList.remove("dark");
      document.documentElement.classList.add("light");
    } else if (id === "dark") {
      document.documentElement.classList.remove("light");
      document.documentElement.classList.add("dark");
    }
    // For other schemas (forest, ocean, etc.), we use the scheme's own dark/light variants
    // The theme is determined by whether the .dark class exists on the document
  }, []);

  const setCustomToken = useCallback((key: keyof ColorTokens, value: string) => {
    setState((prev) => ({
      ...prev,
      schemaId: "custom",
      custom: { ...prev.custom, [key]: value },
    }));
  }, []);

  useEffect(() => {
    applySchema(state, theme === "dark");
    try {
      localStorage.setItem(SCHEMA_STORAGE_KEY, JSON.stringify(state));
    } catch { /* ignore */ }
  }, [state, theme]);

  const currentSchema = PREDEFINED_SCHEMAS.find((s) => s.id === state.schemaId);
  const currentTokens = state.schemaId === "custom" ? state.custom : (currentSchema?.light ?? DEFAULT_CUSTOM);

  const value = useMemo(
    () => ({
      schemaId: state.schemaId, 
      custom: state.custom, 
      setSchemaId, 
      setCustomToken, 
      currentTokens,
      toggleDarkMode: () => {
        const isDark = document.documentElement.classList.contains("dark");
        if (isDark) {
          document.documentElement.classList.remove("dark");
          document.documentElement.classList.add("light");
        } else {
          document.documentElement.classList.remove("light");
          document.documentElement.classList.add("dark");
        }
        // Force re-apply of styles
        setState((prev) => ({ ...prev }));
      },
    }),
    [state.schemaId, state.custom, setSchemaId, setCustomToken, currentTokens],
  );

  return <ColorSchemaContext.Provider value={value}>{children}</ColorSchemaContext.Provider>;
}

export function useColorSchema() {
  const ctx = useContext(ColorSchemaContext);
  if (!ctx) throw new Error("useColorSchema must be used within ColorSchemaProvider");
  return ctx;
}
