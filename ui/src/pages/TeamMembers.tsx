import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "../context/CompanyContext";
import { useToast } from "../context/ToastContext";
import { teamApi, type TeamMember, type PendingInvitation } from "../api/team";
import { Button } from "@/components/ui/button";
import { Tooltip } from "../components/Tooltip";
import { UserPlus, Trash2, ChevronDown, Copy, Check } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const ROLES = ["company_admin", "manager", "viewer"] as const;
type Role = (typeof ROLES)[number];

const ROLE_LABELS: Record<Role, string> = {
  company_admin: "Admin",
  manager: "Manager",
  viewer: "Viewer",
};

export function TeamMembers() {
  const { selectedCompanyId } = useCompany();
  const { pushToast } = useToast();
  const queryClient = useQueryClient();

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("viewer");
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [copiedInviteId, setCopiedInviteId] = useState<string | null>(null);

  const membersQuery = useQuery({
    queryKey: ["team-members", selectedCompanyId],
    queryFn: () => teamApi.listMembers(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const invitationsQuery = useQuery({
    queryKey: ["team-invitations", selectedCompanyId],
    queryFn: () => teamApi.listInvitations(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const inviteMutation = useMutation({
    mutationFn: ({ email, role }: { email: string; role: string }) =>
      teamApi.inviteUser(selectedCompanyId!, email, role),
    onSuccess: (data) => {
      const link = `${window.location.origin}${data.invitation.acceptLink}`;
      setInviteLink(link);
      setInviteEmail("");
      queryClient.invalidateQueries({ queryKey: ["team-invitations", selectedCompanyId] });
      pushToast({ title: "Invitation created", tone: "success" });
    },
    onError: (err: Error) => {
      pushToast({ title: err.message, tone: "error" });
    },
  });

  const roleChangeMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      teamApi.updateRole(selectedCompanyId!, userId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-members", selectedCompanyId] });
      pushToast({ title: "Role updated", tone: "success" });
    },
    onError: (err: Error) => {
      pushToast({ title: err.message, tone: "error" });
    },
  });

  const removeMutation = useMutation({
    mutationFn: (userId: string) => teamApi.removeMember(selectedCompanyId!, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-members", selectedCompanyId] });
      pushToast({ title: "Member removed", tone: "success" });
    },
    onError: (err: Error) => {
      pushToast({ title: err.message, tone: "error" });
    },
  });

  const revokeInviteMutation = useMutation({
    mutationFn: (invitationId: string) =>
      teamApi.revokeInvitation(selectedCompanyId!, invitationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-invitations", selectedCompanyId] });
      pushToast({ title: "Invitation revoked", tone: "success" });
    },
    onError: (err: Error) => {
      pushToast({ title: err.message, tone: "error" });
    },
  });

  function copyLink() {
    if (!inviteLink) return;
    navigator.clipboard.writeText(inviteLink).then(() => {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    });
  }

  const members: TeamMember[] = membersQuery.data?.members ?? [];
  const invitations: PendingInvitation[] = invitationsQuery.data?.invitations ?? [];

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-sm font-semibold mb-3">Invite team member</h3>
        <div className="flex gap-2">
          <input
            type="email"
            placeholder="colleague@example.com"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="min-w-[90px] justify-between">
                {ROLE_LABELS[inviteRole]}
                <ChevronDown className="h-3 w-3 ml-1 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {ROLES.map((r) => (
                <DropdownMenuItem key={r} onClick={() => setInviteRole(r)}>
                  {ROLE_LABELS[r]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            size="sm"
            disabled={!inviteEmail || inviteMutation.isPending}
            onClick={() => inviteMutation.mutate({ email: inviteEmail, role: inviteRole })}
          >
            <UserPlus className="h-4 w-4 mr-1" />
            Invite
          </Button>
        </div>

        {inviteLink && (
          <div className="mt-2 flex items-center gap-2 rounded-md border border-border bg-muted px-3 py-2">
            <span className="flex-1 truncate text-xs font-mono text-muted-foreground">
              {inviteLink}
            </span>
            <Button size="sm" variant="ghost" onClick={copyLink}>
              {linkCopied ? "Copied!" : "Copy"}
            </Button>
          </div>
        )}
      </div>

      <div>
        <h3 className="text-sm font-semibold mb-3">Members</h3>
        {membersQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : members.length === 0 ? (
          <p className="text-sm text-muted-foreground">No members yet.</p>
        ) : (
          <div className="divide-y divide-border rounded-md border border-border">
            {members.map((m) => (
              <div key={m.userId} className="flex items-center px-4 py-3 gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{m.name ?? m.email ?? m.userId}</p>
                  {m.email && m.name && (
                    <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                  )}
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="min-w-[90px] justify-between">
                      {ROLE_LABELS[m.role as Role] ?? m.role}
                      <ChevronDown className="h-3 w-3 ml-1 opacity-50" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {ROLES.map((r) => (
                      <DropdownMenuItem
                        key={r}
                        onClick={() => roleChangeMutation.mutate({ userId: m.userId, role: r })}
                      >
                        {ROLE_LABELS[r]}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeMutation.mutate(m.userId)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {invitations.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-3">Pending invitations</h3>
          <div className="divide-y divide-border rounded-md border border-border">
            {invitations.map((inv) => (
              <div key={inv.id} className="flex items-center px-4 py-3 gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{inv.email}</p>
                  <p className="text-xs text-muted-foreground">
                    {ROLE_LABELS[inv.role as Role] ?? inv.role} · expires{" "}
                    {new Date(inv.expiresAt).toLocaleDateString()}
                  </p>
                </div>
                <Tooltip content="Copy invite link">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground"
                    onClick={() => {
                      const link = `${window.location.origin}/accept-user-invite/${inv.token}`;
                      navigator.clipboard.writeText(link).then(() => {
                        setCopiedInviteId(inv.id);
                        setTimeout(() => setCopiedInviteId(null), 2000);
                      });
                    }}
                  >
                    {copiedInviteId === inv.id
                      ? <Check className="h-4 w-4 text-green-600" />
                      : <Copy className="h-4 w-4" />}
                  </Button>
                </Tooltip>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => revokeInviteMutation.mutate(inv.id)}
                  className="text-destructive hover:text-destructive"
                >
                  Revoke
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
