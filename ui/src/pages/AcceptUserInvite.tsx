import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "@/lib/router";
import { authApi } from "../api/auth";
import { teamApi } from "../api/team";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";

type AcceptMode = "sign_up" | "sign_in";

export function AcceptUserInvitePage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const params = useParams();
  const token = (params.token ?? "").trim();

  const [mode, setMode] = useState<AcceptMode>("sign_up");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const inviteQuery = useQuery({
    queryKey: ["user-invitations", token],
    queryFn: () => teamApi.getInviteDetails(token),
    enabled: token.length > 0,
    retry: false,
  });

  const invite = inviteQuery.data?.invitation;

  const mutation = useMutation({
    mutationFn: async () => {
      if (!invite) throw new Error("Invite not found");
      const email = invite.email;

      if (mode === "sign_up") {
        await authApi.signUpEmail({
          name: name.trim(),
          email,
          password,
        });
      } else {
        await authApi.signInEmail({ email, password });
      }

      const result = await teamApi.claimInvite(token);
      return result;
    },
    onSuccess: async (result) => {
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ["user-invitations"] });
      await queryClient.invalidateQueries({ queryKey: ["auth", "session"] });
      await queryClient.invalidateQueries({ queryKey: ["companies"] });
      navigate(`/${result.issuePrefix ?? result.companyId}/dashboard`, { replace: true });
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Something went wrong");
    },
  });

  const canSubmit =
    password.trim().length >= 8 &&
    (mode === "sign_in" || name.trim().length > 0);

  if (!token) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <p className="text-sm text-destructive">Invalid invite link.</p>
      </div>
    );
  }

  if (inviteQuery.isLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading invite…</p>
      </div>
    );
  }

  if (inviteQuery.error || !invite) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-full max-w-md rounded-lg border border-border bg-card p-6">
          <h1 className="text-lg font-semibold">Invite not available</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This invite may be expired, revoked, or already used.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex bg-background">
      {/* Form */}
      <div className="w-full md:w-1/2 flex flex-col overflow-y-auto">
        <div className="w-full max-w-md mx-auto my-auto px-8 py-12">
          <div className="flex items-center gap-2 mb-8">
            <Sparkles className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Paperclip</span>
          </div>

          {/* Invite summary */}
          <div className="mb-6 rounded-md border border-border bg-muted/30 px-4 py-3 text-sm">
            <p className="text-muted-foreground">
              You have been invited to join{" "}
              {invite.companyName ? (
                <span className="font-semibold text-foreground">{invite.companyName}</span>
              ) : (
                "a company"
              )}{" "}
              as <span className="font-semibold text-foreground">{invite.role}</span>.
            </p>
          </div>

          <h1 className="text-xl font-semibold">Accept your invitation</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "sign_up"
              ? "Create an account to join the team."
              : "Sign in to your existing account to join the team."}
          </p>

          {/* Tab switcher */}
          <div className="mt-5 flex gap-2">
            <button
              type="button"
              onClick={() => { setError(null); setMode("sign_up"); }}
              className={`rounded-md border px-3 py-1.5 text-sm ${
                mode === "sign_up"
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-background text-foreground"
              }`}
            >
              Create account
            </button>
            <button
              type="button"
              onClick={() => { setError(null); setMode("sign_in"); }}
              className={`rounded-md border px-3 py-1.5 text-sm ${
                mode === "sign_in"
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-background text-foreground"
              }`}
            >
              Sign in
            </button>
          </div>

          <form
            className="mt-6 space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (mutation.isPending) return;
              if (!canSubmit) {
                setError("Please fill in all required fields.");
                return;
              }
              mutation.mutate();
            }}
          >
            {mode === "sign_up" && (
              <div>
                <label htmlFor="name" className="text-xs text-muted-foreground mb-1 block">
                  Name
                </label>
                <input
                  id="name"
                  name="name"
                  className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/50"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  autoComplete="name"
                  autoFocus
                />
              </div>
            )}

            <div>
              <label htmlFor="email" className="text-xs text-muted-foreground mb-1 block">
                Email
              </label>
              <input
                id="email"
                name="email"
                className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring opacity-60 cursor-not-allowed"
                type="email"
                value={invite.email}
                readOnly
                autoComplete="email"
              />
            </div>

            <div>
              <label htmlFor="password" className="text-xs text-muted-foreground mb-1 block">
                Password
              </label>
              <input
                id="password"
                name="password"
                className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/50"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete={mode === "sign_in" ? "current-password" : "new-password"}
                autoFocus={mode === "sign_in"}
                placeholder={mode === "sign_up" ? "At least 8 characters" : ""}
              />
            </div>

            {error && <p className="text-xs text-destructive">{error}</p>}

            <Button
              type="submit"
              disabled={mutation.isPending}
              aria-disabled={!canSubmit || mutation.isPending}
              className={`w-full ${!canSubmit && !mutation.isPending ? "opacity-50" : ""}`}
            >
              {mutation.isPending
                ? "Working…"
                : mode === "sign_up"
                  ? "Create account & join"
                  : "Sign in & join"}
            </Button>
          </form>
        </div>
      </div>

      {/* Right half — decorative (hidden on mobile) */}
      <div className="hidden md:flex md:w-1/2 items-center justify-center bg-muted/20">
        <div className="text-center space-y-2 px-8">
          <Sparkles className="h-8 w-8 mx-auto text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground/60">Paperclip</p>
        </div>
      </div>
    </div>
  );
}
