import { Link } from "@/lib/router";
import type { Agent } from "@paperclipai/shared";
import { AgentIcon } from "./AgentIconPicker";

interface IdleAgentsLoungeProps {
  agents: Agent[];
}

export function IdleAgentsLounge({ agents }: IdleAgentsLoungeProps) {
  const idleAgents = agents.filter((a) => a.status === "idle");

  if (idleAgents.length === 0) return null;

  return (
    <div>
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Idle Agents
        <span className="ml-2 text-xs font-normal normal-case text-muted-foreground/60">
          {idleAgents.length} available
        </span>
      </h3>
      <div className="flex flex-wrap gap-3">
        {idleAgents.map((agent) => (
          <Link
            key={agent.id}
            to={`/agents/${agent.id}`}
            className="group flex flex-col items-center gap-1.5 rounded-xl border border-border bg-background/70 px-4 py-3 text-center transition-colors hover:bg-accent/50 no-underline text-inherit"
          >
            <div className="relative">
              <AgentIcon
                icon={agent.icon}
                avatarUrl={agent.avatarUrl}
                className="h-10 w-10 rounded-full text-muted-foreground"
              />
              {/* idle status dot */}
              <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-background bg-emerald-400" />
            </div>
            <span className="max-w-[80px] truncate text-xs font-medium leading-tight">
              {agent.name}
            </span>
            {agent.title && (
              <span className="max-w-[80px] truncate text-[10px] text-muted-foreground leading-tight">
                {agent.title}
              </span>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
