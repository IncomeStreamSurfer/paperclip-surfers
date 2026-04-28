import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Shield, ShieldOff, Ban, CheckCircle, Search, Users } from "lucide-react";
import { accessApi } from "@/api/access";
import type { AdminUser } from "@/api/access";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { cn } from "../lib/utils";

function RoleBadge({ isAdmin }: { isAdmin: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
        isAdmin
          ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
          : "bg-muted text-muted-foreground"
      )}
    >
      {isAdmin ? <Shield className="h-3 w-3" /> : null}
      {isAdmin ? "Instance Admin" : "User"}
    </span>
  );
}

function StatusBadge({ banned }: { banned: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
        banned
          ? "bg-destructive/15 text-destructive"
          : "bg-green-500/15 text-green-600 dark:text-green-400"
      )}
    >
      {banned ? <Ban className="h-3 w-3" /> : <CheckCircle className="h-3 w-3" />}
      {banned ? "Banned" : "Active"}
    </span>
  );
}

export default function InstanceUsersPage() {
  const { setBreadcrumbs } = useBreadcrumbs();
  useEffect(() => {
    setBreadcrumbs([{ label: "Instance" }, { label: "Users" }]);
  }, [setBreadcrumbs]);

  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");

  const { data: users = [], isLoading } = useQuery({
    queryKey: queryKeys.admin.users,
    queryFn: () => accessApi.listAdminUsers(),
  });

  const promote = useMutation({
    mutationFn: (userId: string) => accessApi.promoteInstanceAdmin(userId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.admin.users }),
  });

  const demote = useMutation({
    mutationFn: (userId: string) => accessApi.demoteInstanceAdmin(userId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.admin.users }),
  });

  const ban = useMutation({
    mutationFn: (userId: string) => accessApi.banUser(userId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.admin.users }),
  });

  const unban = useMutation({
    mutationFn: (userId: string) => accessApi.unbanUser(userId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.admin.users }),
  });

  const filtered = users.filter(
    (u) =>
      !search.trim() ||
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
  );

  const isPending = (userId: string) =>
    promote.isPending || demote.isPending || ban.isPending || unban.isPending
      ? promote.variables === userId ||
        demote.variables === userId ||
        ban.variables === userId ||
        unban.variables === userId
      : false;

  return (
    <div className="flex flex-col gap-6 p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3">
        <Users className="h-5 w-5 text-muted-foreground shrink-0" />
        <div>
          <h1 className="text-lg font-semibold">User Management</h1>
          <p className="text-sm text-muted-foreground">
            Manage instance users, roles, and access.
          </p>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <input
          type="search"
          placeholder="Search by name or email…"
          className="w-full pl-9 pr-4 py-2 text-sm rounded-md border border-border bg-background outline-none focus:border-primary"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground py-8 text-center">Loading users…</div>
      ) : filtered.length === 0 ? (
        <div className="text-sm text-muted-foreground py-8 text-center">No users found.</div>
      ) : (
        <div className="rounded-md border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">User</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Role</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Status</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Joined</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((user: AdminUser) => (
                <tr key={user.id} className={cn("hover:bg-muted/20", user.banned && "opacity-60")}>
                  <td className="px-4 py-3">
                    <div className="font-medium">{user.name}</div>
                    <div className="text-xs text-muted-foreground">{user.email}</div>
                  </td>
                  <td className="px-4 py-3">
                    <RoleBadge isAdmin={user.isInstanceAdmin} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge banned={user.banned} />
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {user.isInstanceAdmin ? (
                        <button
                          type="button"
                          disabled={isPending(user.id)}
                          onClick={() => demote.mutate(user.id)}
                          className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-50"
                          title="Remove instance admin"
                        >
                          <ShieldOff className="h-3.5 w-3.5" />
                          Demote
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={isPending(user.id)}
                          onClick={() => promote.mutate(user.id)}
                          className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-50"
                          title="Make instance admin"
                        >
                          <Shield className="h-3.5 w-3.5" />
                          Promote
                        </button>
                      )}
                      {user.banned ? (
                        <button
                          type="button"
                          disabled={isPending(user.id)}
                          onClick={() => unban.mutate(user.id)}
                          className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-green-600 hover:bg-green-500/10 disabled:opacity-50"
                          title="Unban user"
                        >
                          <CheckCircle className="h-3.5 w-3.5" />
                          Unban
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={isPending(user.id)}
                          onClick={() => ban.mutate(user.id)}
                          className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-destructive hover:bg-destructive/10 disabled:opacity-50"
                          title="Ban user"
                        >
                          <Ban className="h-3.5 w-3.5" />
                          Ban
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        {filtered.length} of {users.length} user{users.length !== 1 ? "s" : ""}
      </p>
    </div>
  );
}
