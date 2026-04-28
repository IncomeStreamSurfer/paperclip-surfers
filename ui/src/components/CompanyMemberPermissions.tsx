import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "../context/CompanyContext";
import { useToast } from "../context/ToastContext";
import { accessApi, type CompanyMember } from "../api/access";
import { queryKeys } from "../lib/queryKeys";
import { ChevronDown, ChevronRight, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

const PERMISSION_KEYS = [
  "agents:create",
  "users:invite",
  "users:manage_permissions",
  "tasks:assign",
  "tasks:assign_scope",
  "joins:approve",
] as const;

type PermissionKey = (typeof PERMISSION_KEYS)[number];

const PERMISSION_LABELS: Record<PermissionKey, { label: string; description: string }> = {
  "agents:create": {
    label: "Create agents",
    description: "Can add new agents to this company",
  },
  "users:invite": {
    label: "Invite users",
    description: "Can send invitations to new team members",
  },
  "users:manage_permissions": {
    label: "Manage permissions",
    description: "Can change role and permission settings for others",
  },
  "tasks:assign": {
    label: "Assign tasks",
    description: "Can assign issues to agents",
  },
  "tasks:assign_scope": {
    label: "Assign task scope",
    description: "Can set scope constraints when assigning tasks",
  },
  "joins:approve": {
    label: "Approve joins",
    description: "Can approve pending agent and user join requests",
  },
};

const ROLE_LABELS: Record<string, string> = {
  company_admin: "Admin",
  manager: "Manager",
  viewer: "Viewer",
};

function PermissionToggle({
  permissionKey,
  enabled,
  onChange,
  disabled,
}: {
  permissionKey: PermissionKey;
  enabled: boolean;
  onChange: (key: PermissionKey, checked: boolean) => void;
  disabled?: boolean;
}) {
  const info = PERMISSION_LABELS[permissionKey];
  return (
    <label
      className={cn(
        "flex items-center justify-between gap-3 py-2 cursor-pointer",
        disabled && "opacity-50 cursor-not-allowed",
      )}
    >
      <div className="min-w-0">
        <p className="text-xs font-medium">{info.label}</p>
        <p className="text-[11px] text-muted-foreground">{info.description}</p>
      </div>
      <button
        role="switch"
        aria-checked={enabled}
        disabled={disabled}
        onClick={() => !disabled && onChange(permissionKey, !enabled)}
        className={cn(
          "relative inline-flex h-4.5 w-8 shrink-0 cursor-pointer items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          enabled ? "bg-primary" : "bg-muted-foreground/30",
          disabled && "cursor-not-allowed",
        )}
      >
        <span
          className={cn(
            "pointer-events-none block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform",
            enabled ? "translate-x-[18px]" : "translate-x-0.5",
          )}
        />
      </button>
    </label>
  );
}

function MemberPermissionRow({
  member,
  onUpdate,
  isPending,
}: {
  member: CompanyMember;
  onUpdate: (memberId: string, grants: { permissionKey: string }[]) => void;
  isPending: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  const displayName =
    member.userName ?? member.userEmail ?? member.principalId;
  const displayEmail =
    member.userEmail && member.userName ? member.userEmail : null;
  const role = member.membershipRole ?? "member";

  function handleToggle(key: PermissionKey, checked: boolean) {
    const current = new Set(member.permissions);
    if (checked) {
      current.add(key);
    } else {
      current.delete(key);
    }
    const grants = Array.from(current).map((k) => ({ permissionKey: k }));
    onUpdate(member.id, grants);
  }

  return (
    <div className="border-b border-border last:border-b-0">
      <button
        className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted/40 transition-colors text-left"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="text-muted-foreground shrink-0">
          {expanded ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{displayName}</p>
          {displayEmail && (
            <p className="text-xs text-muted-foreground truncate">{displayEmail}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {member.permissions.length > 0 && (
            <span className="inline-flex items-center gap-0.5 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
              <Shield className="h-2.5 w-2.5" />
              {member.permissions.length}
            </span>
          )}
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
            {ROLE_LABELS[role] ?? role}
          </span>
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-3 pt-1 bg-muted/20 space-y-0 divide-y divide-border/50">
          {PERMISSION_KEYS.map((key) => (
            <PermissionToggle
              key={key}
              permissionKey={key}
              enabled={member.permissions.includes(key)}
              onChange={handleToggle}
              disabled={isPending}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function CompanyMemberPermissions() {
  const { selectedCompanyId } = useCompany();
  const { pushToast } = useToast();
  const queryClient = useQueryClient();

  const membersQuery = useQuery({
    queryKey: queryKeys.companyMembers(selectedCompanyId!),
    queryFn: () => accessApi.listCompanyMembers(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const updateMutation = useMutation({
    mutationFn: ({
      memberId,
      grants,
    }: {
      memberId: string;
      grants: { permissionKey: string }[];
    }) => accessApi.updateMemberPermissions(selectedCompanyId!, memberId, grants),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.companyMembers(selectedCompanyId!),
      });
    },
    onError: (err: Error) => {
      pushToast({ title: err.message, tone: "error" });
    },
  });

  const members = (membersQuery.data ?? []).filter(
    (m) => m.principalType === "user",
  );

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        Grant or revoke fine-grained capabilities for each team member. Role
        (Admin / Manager / Viewer) is managed from the Team Members section
        above.
      </p>
      {membersQuery.isLoading ? (
        <p className="text-sm text-muted-foreground py-4">Loading…</p>
      ) : members.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4">No user members yet.</p>
      ) : (
        <div className="rounded-md border border-border overflow-hidden">
          {members.map((m) => (
            <MemberPermissionRow
              key={m.id}
              member={m}
              onUpdate={(memberId, grants) =>
                updateMutation.mutate({ memberId, grants })
              }
              isPending={updateMutation.isPending}
            />
          ))}
        </div>
      )}
    </div>
  );
}
