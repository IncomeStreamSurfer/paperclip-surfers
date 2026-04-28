import { useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Inbox,
  CircleDot,
  Target,
  LayoutDashboard,
  DollarSign,
  History,
  Search,
  SquarePen,
  Network,
  Boxes,
  Repeat,
  Settings,
  Plug,
  BarChart3,
  Share2,
  ChevronDown,
  ChevronsUp,
  ChevronsDown,
  Star,
  PenLine,
  Users,
  Palette,
  Building2,
  FolderKanban,
  FlaskConical,
  Ticket,
  StickyNote,
  BookOpen,
  Zap,
  HardHat,
  Ruler,
  FileText,
  Bot,
  Brain,
} from "lucide-react";
import { cn } from "../lib/utils";
import { useQuery } from "@tanstack/react-query";
import { NavLink } from "@/lib/router";
import { SidebarSection } from "./SidebarSection";
import { SidebarNavItem } from "./SidebarNavItem";
import { SidebarProjects } from "./SidebarProjects";
import { SidebarAgents } from "./SidebarAgents";
import { CompanyPatternIcon } from "./CompanyPatternIcon";
import { AgentIcon } from "./AgentIconPicker";
import { useDialog } from "../context/DialogContext";
import { useCompany } from "../context/CompanyContext";
import { useSidebar, SidebarProvider } from "../context/SidebarContext";
import { heartbeatsApi } from "../api/heartbeats";
import { agentsApi } from "../api/agents";
import { projectsApi } from "../api/projects";
import { queryKeys } from "../lib/queryKeys";
import { useInboxBadge } from "../hooks/useInboxBadge";
import { useBusinessGate } from "../hooks/useBusinessGate";
import { agentUrl, projectRouteRef } from "../lib/utils";
import { Button } from "@/components/ui/button";
import { PluginSlotOutlet } from "@/plugins/slots";
import type { Agent, Project } from "@paperclipai/shared";

// Map of route paths to their icon components for favorites
const ICON_MAP: Record<string, LucideIcon> = {
  "/dashboard": LayoutDashboard,
  "/inbox": Inbox,
  "/issues": CircleDot,
  "/routines": Repeat,
  "/goals": Target,
  "/org": Network,
  "/skills": Boxes,
  "/mcp-servers": Plug,
  "/analytics": BarChart3,
  "/social-media": Share2,
  "/seo": Search,
  "/copywriting": PenLine,
  "/crm": Users,
  "/design": Palette,
  "/departments": Building2,
  "/software": FolderKanban,
  "/research": FlaskConical,
  "/research/projects": FolderKanban,
  "/research/notes": StickyNote,
  "/research/literature": BookOpen,
   "/msp": Ticket,
   "/costs": DollarSign,
   "/activity": History,
   "/company/settings": Settings,
   "/sprints": Zap,
   "/civil": HardHat,
   "/civil/projects": FolderKanban,
   "/civil/drawings": Ruler,
   "/civil/specs": FileText,
};

const LABEL_MAP: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/inbox": "Inbox",
  "/issues": "Issues",
  "/routines": "Routines",
  "/goals": "Goals",
  "/org": "Org",
  "/skills": "Skills",
  "/mcp-servers": "MCPs",
  "/analytics": "Analytics",
  "/social-media": "Social Media",
  "/seo": "SEO",
  "/copywriting": "Copywriting",
  "/crm": "CRM",
  "/design": "Design Studio",
  "/departments": "Departments",
  "/software": "Software",
  "/research": "Research",
  "/research/projects": "Projects",
  "/research/notes": "Notes",
  "/research/literature": "Literature",
   "/msp": "MSP",
   "/costs": "Costs",
   "/activity": "Activity",
   "/company/settings": "Settings",
   "/sprints": "Sprints",
   "/civil": "Civil / Architecture",
   "/civil/projects": "Projects",
   "/civil/drawings": "Drawings",
   "/civil/specs": "Specifications",
};

export function Sidebar() {
  const { openNewIssue } = useDialog();
  const { selectedCompanyId, selectedCompany, companies, setSelectedCompanyId: selectCompany, favoriteCompanyIds, toggleFavorite } = useCompany();
  const inboxBadge = useInboxBadge(selectedCompanyId);
  const showSeo = useBusinessGate("seo");
  const showCopywriting = useBusinessGate("copywriting");
  const showSocialMedia = useBusinessGate("social-media");
  const showCrm = useBusinessGate("crm");
  const showDesign = useBusinessGate("design");
  const showSoftware = useBusinessGate("software");
  const showResearch = useBusinessGate("research");
  const showMsp = useBusinessGate("msp");
  const showCivil = useBusinessGate("civil");
  const { data: liveRuns } = useQuery({
    queryKey: queryKeys.liveRuns(selectedCompanyId!),
    queryFn: () => heartbeatsApi.liveRunsForCompany(selectedCompanyId!),
    enabled: !!selectedCompanyId,
    refetchInterval: 10_000,
  });
  const liveRunCount = liveRuns?.length ?? 0;

  const pluginContext = {
    companyId: selectedCompanyId,
    companyPrefix: selectedCompany?.issuePrefix ?? null,
  };

  const {
    favorites, collapseAll, expandAll, forcedSectionState,
    favoriteAgentIds, favoriteProjectIds,
    toggleFavoriteAgent, toggleFavoriteProject,
  } = useSidebar();

  // These share the TanStack Query cache with SidebarAgents / SidebarProjects below
  const { data: allAgents = [] } = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });
  const { data: allProjects = [] } = useQuery({
    queryKey: queryKeys.projects.list(selectedCompanyId!),
    queryFn: () => projectsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const [sectionsCollapsed, setSectionsCollapsed] = useState(false);
  const handleToggleAll = () => {
    if (sectionsCollapsed) {
      expandAll();
      setSectionsCollapsed(false);
    } else {
      collapseAll();
      setSectionsCollapsed(true);
    }
  };

  // Favorites accordion state — controlled here so the F shortcut can toggle it
  const [favoritesExpanded, setFavoritesExpanded] = useState(true);
  useEffect(() => {
    if (forcedSectionState !== null) {
      setFavoritesExpanded(forcedSectionState.expanded);
    }
  }, [forcedSectionState]);

  // F key shortcut toggles the favorites accordion
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;
      if (e.key === "f" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setFavoritesExpanded((v) => !v);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Build favorite nav items from stored favorite IDs
  const favoriteNavItems = favorites
    .filter((id) => ICON_MAP[id])
    .map((id) => ({
      id,
      to: id,
      label: LABEL_MAP[id] ?? id,
      icon: ICON_MAP[id]!,
    }));

  // Preserve insertion order from favoriteAgentIds / favoriteProjectIds
  const favoriteAgentItems = favoriteAgentIds
    .map((id) => (allAgents as Agent[]).find((a) => a.id === id))
    .filter((a): a is Agent => !!a);
  const favoriteProjectItems = favoriteProjectIds
    .map((id) => (allProjects as Project[]).find((p) => p.id === id))
    .filter((p): p is Project => !!p);

  const hasFavorites =
    favoriteNavItems.length > 0 ||
    favoriteAgentItems.length > 0 ||
    favoriteProjectItems.length > 0;

  const [companyDropdownOpen, setCompanyDropdownOpen] = useState(false);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!companyDropdownOpen) return;
    const handleClickOutside = () => setCompanyDropdownOpen(false);
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [companyDropdownOpen]);

  return (
    <aside className="w-60 h-full min-h-0 border-r border-border bg-sidebar-surface flex flex-col">
      {/* Top bar: Company selector dropdown + actions */}
      <div className="relative flex items-center gap-1 px-3 h-12 shrink-0">
        <div className="relative flex-1">
          <button
            onClick={() => setCompanyDropdownOpen(!companyDropdownOpen)}
            className="flex items-center gap-1.5 w-full max-w-[180px] hover:bg-accent/50 rounded-md px-1 py-1 transition-colors"
          >
            {selectedCompany && (
              <CompanyPatternIcon
                companyName={selectedCompany.name}
                logoUrl={selectedCompany.logoUrl}
                brandColor={selectedCompany.brandColor}
                className="w-5 h-5 rounded-sm shrink-0"
              />
            )}
            <span className="text-sm font-bold text-foreground truncate">
              {selectedCompany?.name ?? "Select company"}
            </span>
            {selectedCompany?.status === "archived" && (
              <span className="text-[10px] text-muted-foreground/60 ml-1">(archived)</span>
            )}
          </button>
          
          {companyDropdownOpen && (
            <div 
              className="absolute top-full left-0 mt-1 w-56 bg-background border border-border rounded-md shadow-lg z-50 py-1 max-h-64 overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {favoriteCompanyIds.length > 0 && (
                <div className="px-3 py-1">
                  <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">Favorites</div>
                </div>
              )}
              {favoriteCompanyIds.map((favId) => {
                const company = companies.find((c) => c.id === favId);
                if (!company) return null;
                return (
                  <button
                    key={favId}
                    onClick={() => {
                      selectCompany(company.id);
                      setCompanyDropdownOpen(false);
                    }}
                    className={`flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-accent/50 transition-colors ${
                      company.id === selectedCompanyId ? "bg-accent" : ""
                    }`}
                  >
                    <CompanyPatternIcon
                      companyName={company.name}
                      logoUrl={company.logoUrl}
                      brandColor={company.brandColor}
                      className="w-4 h-4 rounded-sm"
                    />
                    <span className="truncate flex-1 text-left">{company.name}</span>
                    {company.status === "archived" && (
                      <span className="text-[10px] text-muted-foreground/50 mr-1">archived</span>
                    )}
                    <Star className="h-3 w-3 fill-yellow-500 text-yellow-500 shrink-0" />
                  </button>
                );
              })}
              {(favoriteCompanyIds.length > 0 && companies.filter((c) => !favoriteCompanyIds.includes(c.id)).length > 0) && (
                <div className="px-3 py-1 border-t border-border mt-1">
                  <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">All Companies</div>
                </div>
              )}
              {companies.filter((c) => !favoriteCompanyIds.includes(c.id)).map((company) => (
                <button
                  key={company.id}
                  onClick={() => {
                    selectCompany(company.id);
                    setCompanyDropdownOpen(false);
                  }}
                  className={`flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-accent/50 transition-colors ${
                    company.id === selectedCompanyId ? "bg-accent" : ""
                  } ${company.status === "archived" ? "opacity-50" : ""}`}
                >
                  <CompanyPatternIcon
                    companyName={company.name}
                    logoUrl={company.logoUrl}
                    brandColor={company.brandColor}
                    className="w-4 h-4 rounded-sm"
                  />
                  <span className="truncate flex-1 text-left">{company.name}</span>
                  {company.status === "archived" && (
                    <span className="text-[10px] text-muted-foreground/50 shrink-0">archived</span>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFavorite(company.id);
                    }}
                    className="p-0.5 hover:bg-accent/50 rounded"
                  >
                    <Star className="h-3 w-3 text-muted-foreground hover:text-yellow-500" />
                  </button>
                </button>
              ))}
            </div>
          )}
        </div>

        <Button
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground shrink-0"
          title={sectionsCollapsed ? "Expand all sections" : "Collapse all sections"}
          onClick={handleToggleAll}
        >
          {sectionsCollapsed ? (
            <ChevronsDown className="h-4 w-4" />
          ) : (
            <ChevronsUp className="h-4 w-4" />
          )}
        </Button>

        <Button
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground shrink-0"
          onClick={() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }))}
        >
          <Search className="h-4 w-4" />
        </Button>
      </div>

      <nav className="flex-1 min-h-0 overflow-y-auto scrollbar-auto-hide flex flex-col gap-1 px-3 py-2">
        <div className="flex flex-col gap-0.5 py-1">
          {/* New Issue button aligned with nav items */}
          <button
            onClick={() => openNewIssue()}
            className="flex items-center gap-2.5 px-3 py-2 text-[13px] font-medium text-muted-foreground hover:bg-accent/50 hover:text-foreground transition-colors"
          >
            <SquarePen className="h-4 w-4 shrink-0" />
            <span className="truncate">New Issue</span>
          </button>
          <SidebarNavItem to="/dashboard" label="Dashboard" icon={LayoutDashboard} liveCount={liveRunCount} />
          <SidebarNavItem to="/agents" label="Agents" icon={Bot} liveCount={liveRunCount} />
          <SidebarNavItem
            to="/inbox"
            label="Inbox"
            icon={Inbox}
            badge={inboxBadge.inbox}
            badgeTone={inboxBadge.failedRuns > 0 ? "danger" : "default"}
            alert={inboxBadge.failedRuns > 0}
          />
          <PluginSlotOutlet
            slotTypes={["sidebar"]}
            context={pluginContext}
            className="flex flex-col gap-0.5"
            itemClassName="text-[13px] font-medium"
            missingBehavior="placeholder"
          />
        </div>

        {/* Favorites Section — toggled by F shortcut; after main nav items */}
        {hasFavorites && (
          <>
            <hr className="border-border -mx-3 opacity-60" />
            <div className="group">
              <button
                onClick={() => setFavoritesExpanded((v) => !v)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-medium uppercase tracking-widest font-mono text-muted-foreground hover:text-foreground w-full transition-colors"
              >
                <ChevronDown
                  className={cn(
                    "h-3 w-3 text-muted-foreground transition-transform opacity-0 group-hover:opacity-100",
                    !favoritesExpanded && "-rotate-90",
                  )}
                />
                Favorites
                <kbd className="ml-auto rounded border border-border/60 bg-muted/40 px-1 py-px text-[9px] font-mono text-muted-foreground/70 group-hover:text-muted-foreground transition-colors">
                  F
                </kbd>
              </button>
              {favoritesExpanded && (
                <div className="flex flex-col gap-0.5 mt-0.5">
                  {/* Static nav favorites (Dashboard, Inbox, etc.) */}
                  {favoriteNavItems.map((item) => (
                    <SidebarNavItem
                      key={item.id}
                      to={item.to}
                      label={item.label}
                      icon={item.icon}
                      favoriteId={item.id}
                    />
                  ))}

                  {/* Favorited agents */}
                  {favoriteAgentItems.map((agent) => (
                    <div key={agent.id} className="group/fav-agent relative">
                      <NavLink
                        to={agentUrl(agent)}
                        className={({ isActive }) =>
                          cn(
                            "flex items-center gap-2.5 px-3 py-1.5 pr-7 text-[13px] font-medium transition-colors",
                            isActive
                              ? "bg-accent text-foreground"
                              : "text-foreground/80 hover:bg-accent/50 hover:text-foreground",
                          )
                        }
                      >
                        <AgentIcon
                          icon={agent.icon}
                          avatarUrl={agent.avatarUrl}
                          className="shrink-0 h-3.5 w-3.5 text-muted-foreground"
                        />
                        <span className="flex-1 truncate">{agent.name}</span>
                      </NavLink>
                      <button
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleFavoriteAgent(agent.id); }}
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 rounded opacity-100 transition-opacity"
                        title="Remove from favourites"
                      >
                        <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />
                      </button>
                    </div>
                  ))}

                  {/* Favorited projects */}
                  {favoriteProjectItems.map((project) => (
                    <div key={project.id} className="group/fav-project relative">
                      <NavLink
                        to={`/projects/${projectRouteRef(project)}/issues`}
                        className={({ isActive }) =>
                          cn(
                            "flex items-center gap-2.5 px-3 py-1.5 pr-7 text-[13px] font-medium transition-colors",
                            isActive
                              ? "bg-accent text-foreground"
                              : "text-foreground/80 hover:bg-accent/50 hover:text-foreground",
                          )
                        }
                      >
                        <span
                          className="shrink-0 h-3.5 w-3.5 rounded-sm"
                          style={{ backgroundColor: project.color ?? "#6366f1" }}
                        />
                        <span className="flex-1 truncate">{project.name}</span>
                      </NavLink>
                      <button
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleFavoriteProject(project.id); }}
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 rounded opacity-100 transition-opacity"
                        title="Remove from favourites"
                      >
                        <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        <hr className="border-border -mx-3 opacity-60" />

        <SidebarSection label="Work">
          <SidebarNavItem to="/issues" label="Issues" icon={CircleDot} />
          <SidebarNavItem to="/routines" label="Routines" icon={Repeat} />
          <SidebarNavItem to="/goals" label="Goals" icon={Target} />
        </SidebarSection>

        <hr className="border-border -mx-3 opacity-60" />

        <SidebarAgents />

        <hr className="border-border -mx-3 opacity-60" />

        <SidebarProjects />

        <hr className="border-border -mx-3 opacity-60" />

        <SidebarSection label="Company">
          <SidebarNavItem to="/org" label="Org" icon={Network} />
          <SidebarNavItem to="/departments" label="Departments" icon={Building2} />
          <SidebarNavItem to="/skills" label="Skills" icon={Boxes} />
          <SidebarNavItem to="/mcp-servers" label="MCPs" icon={Plug} />
          <SidebarNavItem to="/knowledge" label="Knowledge" icon={BookOpen} />
          <SidebarNavItem to="/memory" label="MemPalace" icon={Brain} />
          {showSoftware && <SidebarNavItem to="/software" label="Software" icon={FolderKanban} />}
          {showSocialMedia && <SidebarNavItem to="/social-media" label="Social Media" icon={Share2} />}
          {showSeo && <SidebarNavItem to="/seo" label="SEO" icon={Search} />}
          {showCopywriting && <SidebarNavItem to="/copywriting" label="Copywriting" icon={PenLine} />}
          {showCrm && <SidebarNavItem to="/crm" label="CRM" icon={Users} />}
          {showDesign && <SidebarNavItem to="/design" label="Design Studio" icon={Palette} />}
           {showResearch && <SidebarNavItem to="/research" label="Research" icon={FlaskConical} end />}
           {showResearch && (
             <div className="pl-3 space-y-0.5">
               <SidebarNavItem to="/research/projects" label="Projects" icon={FolderKanban} />
               <SidebarNavItem to="/research/notes" label="Notes" icon={StickyNote} />
               <SidebarNavItem to="/research/literature" label="Literature" icon={BookOpen} />
             </div>
           )}
           {showMsp && <SidebarNavItem to="/msp" label="MSP" icon={Ticket} />}
           {showCivil && <SidebarNavItem to="/civil" label="Civil / Architecture" icon={HardHat} end />}
           {showCivil && (
             <div className="pl-3 space-y-0.5">
               <SidebarNavItem to="/civil/projects" label="Projects" icon={FolderKanban} />
               <SidebarNavItem to="/civil/drawings" label="Drawings" icon={Ruler} />
               <SidebarNavItem to="/civil/specs" label="Specifications" icon={FileText} />
             </div>
           )}
           <SidebarNavItem to="/sprints" label="Sprints" icon={Zap} />
          <SidebarNavItem to="/analytics" label="Analytics" icon={BarChart3} />
          <SidebarNavItem to="/costs" label="Costs" icon={DollarSign} />
          <SidebarNavItem to="/activity" label="Activity" icon={History} />
          <SidebarNavItem to="/company/settings" label="Settings" icon={Settings} />
        </SidebarSection>

        <PluginSlotOutlet
          slotTypes={["sidebarPanel"]}
          context={pluginContext}
          className="flex flex-col gap-3"
          itemClassName="rounded-lg border border-border p-3"
          missingBehavior="placeholder"
        />
      </nav>
    </aside>
  );
}
