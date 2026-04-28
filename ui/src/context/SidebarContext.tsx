import { createContext, useCallback, useContext, useState, useEffect, type ReactNode } from "react";

interface SidebarContextValue {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  isMobile: boolean;
  /** Nav-item favorites (paths like "/dashboard") */
  favorites: string[];
  toggleFavorite: (id: string) => void;
  isFavorite: (id: string) => boolean;
  /** Project favorites (project IDs) */
  favoriteProjectIds: string[];
  toggleFavoriteProject: (id: string) => void;
  isFavoriteProject: (id: string) => boolean;
  /** Agent favorites (agent IDs) */
  favoriteAgentIds: string[];
  toggleFavoriteAgent: (id: string) => void;
  isFavoriteAgent: (id: string) => boolean;
  /** When non-null, all sections should snap to this expanded state. Version increments on each call. */
  forcedSectionState: { version: number; expanded: boolean } | null;
  collapseAll: () => void;
  expandAll: () => void;
}

const FAVORITES_KEY = "paperclip.sidebar.favorites";
const FAVORITE_PROJECTS_KEY = "paperclip.sidebar.favorite-projects";
const FAVORITE_AGENTS_KEY = "paperclip.sidebar.favorite-agents";

const SidebarContext = createContext<SidebarContextValue | null>(null);

type ForcedState = { version: number; expanded: boolean } | null;

const MOBILE_BREAKPOINT = 768;

function loadList(key: string): string[] {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as string[];
  } catch { /* ignore */ }
  return [];
}

function saveList(key: string, ids: string[]) {
  try {
    localStorage.setItem(key, JSON.stringify(ids));
  } catch { /* ignore */ }
}

function makeToggler(key: string, setter: React.Dispatch<React.SetStateAction<string[]>>) {
  return (id: string) => {
    setter((prev) => {
      const next = prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id];
      saveList(key, next);
      return next;
    });
  };
}

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < MOBILE_BREAKPOINT);
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth >= MOBILE_BREAKPOINT);
  const [favorites, setFavorites] = useState<string[]>(() => loadList(FAVORITES_KEY));
  const [favoriteProjectIds, setFavoriteProjectIds] = useState<string[]>(() => loadList(FAVORITE_PROJECTS_KEY));
  const [favoriteAgentIds, setFavoriteAgentIds] = useState<string[]>(() => loadList(FAVORITE_AGENTS_KEY));
  const [forcedSectionState, setForcedSectionState] = useState<ForcedState>(null);

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = (e: MediaQueryListEvent) => {
      setIsMobile(e.matches);
      setSidebarOpen(!e.matches);
    };
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  const toggleSidebar = useCallback(() => setSidebarOpen((v) => !v), []);

  const toggleFavorite = useCallback(makeToggler(FAVORITES_KEY, setFavorites), []);
  const toggleFavoriteProject = useCallback(makeToggler(FAVORITE_PROJECTS_KEY, setFavoriteProjectIds), []);
  const toggleFavoriteAgent = useCallback(makeToggler(FAVORITE_AGENTS_KEY, setFavoriteAgentIds), []);

  const isFavorite = useCallback((id: string) => favorites.includes(id), [favorites]);
  const isFavoriteProject = useCallback((id: string) => favoriteProjectIds.includes(id), [favoriteProjectIds]);
  const isFavoriteAgent = useCallback((id: string) => favoriteAgentIds.includes(id), [favoriteAgentIds]);

  const collapseAll = useCallback(() => {
    setForcedSectionState((s) => ({ version: (s?.version ?? 0) + 1, expanded: false }));
  }, []);

  const expandAll = useCallback(() => {
    setForcedSectionState((s) => ({ version: (s?.version ?? 0) + 1, expanded: true }));
  }, []);

  return (
    <SidebarContext.Provider
      value={{
        sidebarOpen, setSidebarOpen, toggleSidebar, isMobile,
        favorites, toggleFavorite, isFavorite,
        favoriteProjectIds, toggleFavoriteProject, isFavoriteProject,
        favoriteAgentIds, toggleFavoriteAgent, isFavoriteAgent,
        forcedSectionState, collapseAll, expandAll,
      }}
    >
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const ctx = useContext(SidebarContext);
  if (!ctx) {
    throw new Error("useSidebar must be used within SidebarProvider");
  }
  return ctx;
}
