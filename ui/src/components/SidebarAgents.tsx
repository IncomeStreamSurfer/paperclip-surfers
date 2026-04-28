import { useEffect, useMemo, useState } from "react";
import { NavLink, useLocation } from "@/lib/router";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Plus, Star } from "lucide-react";
import { useCompany } from "../context/CompanyContext";
import { useDialog } from "../context/DialogContext";
import { useSidebar } from "../context/SidebarContext";
import { agentsApi } from "../api/agents";
import { authApi } from "../api/auth";
import { heartbeatsApi } from "../api/heartbeats";
import { queryKeys } from "../lib/queryKeys";
import { cn, agentRouteRef, agentUrl } from "../lib/utils";
import { useAgentOrder } from "../hooks/useAgentOrder";
import { AgentIcon } from "./AgentIconPicker";
import { BudgetSidebarMarker } from "./BudgetSidebarMarker";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { Agent } from "@paperclipai/shared";

export function SidebarAgents() {
  const [open, setOpen] = useState(true);
  const { selectedCompanyId } = useCompany();
  const { openNewAgent } = useDialog();
  const {
    isMobile,
    setSidebarOpen,
    forcedSectionState,
    favoriteAgentIds,
    toggleFavoriteAgent,
    isFavoriteAgent,
  } = useSidebar();
  const location = useLocation();

  useEffect(() => {
    if (forcedSectionState !== null) {
      setOpen(forcedSectionState.expanded);
    }
  }, [forcedSectionState]);

  const { data: agents } = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });
  const { data: session } = useQuery({
    queryKey: queryKeys.auth.session,
    queryFn: () => authApi.getSession(),
  });

  const { data: liveRuns } = useQuery({
    queryKey: queryKeys.liveRuns(selectedCompanyId!),
    queryFn: () => heartbeatsApi.liveRunsForCompany(selectedCompanyId!),
    enabled: !!selectedCompanyId,
    refetchInterval: 10_000,
  });

  const liveCountByAgent = useMemo(() => {
    const counts = new Map<string, number>();
    for (const run of liveRuns ?? []) {
      counts.set(run.agentId, (counts.get(run.agentId) ?? 0) + 1);
    }
    return counts;
  }, [liveRuns]);

  const visibleAgents = useMemo(
    () => (agents ?? []).filter((a: Agent) => a.status !== "terminated"),
    [agents],
  );
  const currentUserId = session?.user?.id ?? session?.session?.userId ?? null;
  const { orderedAgents } = useAgentOrder({
    agents: visibleAgents,
    companyId: selectedCompanyId,
    userId: currentUserId,
  });

  // Starred agents float to the top, preserving relative order within each group
  const displayAgents = useMemo(
    () => [
      ...orderedAgents.filter((a) => isFavoriteAgent(a.id)),
      ...orderedAgents.filter((a) => !isFavoriteAgent(a.id)),
    ],
    [orderedAgents, isFavoriteAgent, favoriteAgentIds], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const agentMatch = location.pathname.match(/^\/(?:[^/]+\/)?agents\/([^/]+)(?:\/([^/]+))?/);
  const activeAgentId = agentMatch?.[1] ?? null;
  const activeTab = agentMatch?.[2] ?? null;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="group">
        <div className="flex items-center px-3 py-1.5">
          <CollapsibleTrigger className="flex items-center gap-1 flex-1 min-w-0">
            <ChevronRight
              className={cn(
                "h-3 w-3 text-muted-foreground transition-transform opacity-0 group-hover:opacity-100",
                open && "rotate-90",
              )}
            />
            <span className="text-[10px] font-medium uppercase tracking-widest font-mono text-muted-foreground">
              Agents
            </span>
          </CollapsibleTrigger>
          <button
            onClick={(e) => {
              e.stopPropagation();
              openNewAgent();
            }}
            className="flex items-center justify-center h-4 w-4 rounded text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
            aria-label="New agent"
          >
            <Plus className="h-3 w-3" />
          </button>
        </div>
      </div>

      <CollapsibleContent>
        <div className="flex flex-col gap-0.5 mt-0.5">
          {displayAgents.map((agent: Agent) => {
            const runCount = liveCountByAgent.get(agent.id) ?? 0;
            const isFav = isFavoriteAgent(agent.id);
            return (
              <div key={agent.id} className="group relative">
                <NavLink
                  to={activeTab ? `${agentUrl(agent)}/${activeTab}` : agentUrl(agent)}
                  onClick={() => {
                    if (isMobile) setSidebarOpen(false);
                  }}
                  className={cn(
                    "flex items-center gap-2.5 px-3 py-1.5 pr-7 text-[13px] font-medium transition-colors",
                    activeAgentId === agentRouteRef(agent)
                      ? "bg-accent text-foreground"
                      : "text-foreground/80 hover:bg-accent/50 hover:text-foreground",
                  )}
                >
                  <AgentIcon icon={agent.icon} avatarUrl={agent.avatarUrl} className="shrink-0 h-3.5 w-3.5 text-muted-foreground" />
                  <span className="flex-1 truncate">{agent.name}</span>
                  {(agent.pauseReason === "budget" || runCount > 0) && (
                    <span className="flex items-center gap-1.5 shrink-0">
                      {agent.pauseReason === "budget" ? (
                        <BudgetSidebarMarker title="Agent paused by budget" />
                      ) : null}
                      {runCount > 0 ? (
                        <span className="relative flex h-2 w-2">
                          <span className="animate-pulse absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
                        </span>
                      ) : null}
                      {runCount > 0 ? (
                        <span className="text-[11px] font-medium text-blue-600 dark:text-blue-400">
                          {runCount} live
                        </span>
                      ) : null}
                    </span>
                  )}
                </NavLink>
                <button
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleFavoriteAgent(agent.id); }}
                  className={cn(
                    "absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 rounded transition-opacity",
                    isFav ? "opacity-100" : "opacity-0 group-hover:opacity-100",
                  )}
                  title={isFav ? "Remove from favourites" : "Add to favourites"}
                >
                  <Star className={cn("h-3 w-3", isFav ? "fill-yellow-500 text-yellow-500" : "text-muted-foreground hover:text-yellow-500")} />
                </button>
              </div>
            );
          })}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
