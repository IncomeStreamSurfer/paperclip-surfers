import { Navigate, Outlet, Route, Routes, useLocation, useParams } from "@/lib/router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Layout } from "./components/Layout";
import { OnboardingWizard } from "./components/OnboardingWizard";
import { authApi } from "./api/auth";
import { healthApi } from "./api/health";
import { instanceSettingsApi } from "./api/instanceSettings";
import { Dashboard } from "./pages/Dashboard";
import { DashboardFullscreen } from "./pages/DashboardFullscreen";
import { Companies } from "./pages/Companies";
import { Agents } from "./pages/Agents";
import { AgentDetail } from "./pages/AgentDetail";
import { Projects } from "./pages/Projects";
import { ArchivedProjects } from "./pages/ArchivedProjects";
import { ProjectDetail } from "./pages/ProjectDetail";
import { Issues } from "./pages/Issues";
import { IssueDetail } from "./pages/IssueDetail";
import { Routines } from "./pages/Routines";
import { RoutineDetail } from "./pages/RoutineDetail";
import { ExecutionWorkspaceDetail } from "./pages/ExecutionWorkspaceDetail";
import { Goals } from "./pages/Goals";
import { GoalDetail } from "./pages/GoalDetail";
import { Approvals } from "./pages/Approvals";
import { ApprovalDetail } from "./pages/ApprovalDetail";
import { Costs } from "./pages/Costs";
import { Activity } from "./pages/Activity";
import { Inbox } from "./pages/Inbox";
import { CompanySettings } from "./pages/CompanySettings";
import { ModelSettings } from "./pages/ModelSettings";
import { LabelSettings } from "./pages/LabelSettings";
import { MessagingSettings } from "./pages/MessagingSettings";
import { CompanySkills } from "./pages/CompanySkills";
import { McpServers } from "./pages/McpServers";
import { Analytics } from "./pages/Analytics";
import { CompanyExport } from "./pages/CompanyExport";
import { CompanyImport } from "./pages/CompanyImport";
import { DesignGuide } from "./pages/DesignGuide";
import { InstanceGeneralSettings } from "./pages/InstanceGeneralSettings";
import { InstanceSettings } from "./pages/InstanceSettings";
import { InstanceExperimentalSettings } from "./pages/InstanceExperimentalSettings";
import { InstanceNotificationsSettings } from "./pages/InstanceNotificationsSettings";
import InstanceUsersPage from "./pages/InstanceUsersPage";
import { InstanceCliAuthSettings } from "./pages/InstanceCliAuthSettings";
import { ProfilePage } from "./pages/ProfilePage";
import { SocialMediaOverview } from "./pages/SocialMediaOverview";
import { SocialMediaAccounts } from "./pages/SocialMediaAccounts";
import { SocialMediaPosts } from "./pages/SocialMediaPosts";
import { SocialMediaPostDetail } from "./pages/SocialMediaPostDetail";
import { SeoOverview } from "./pages/SeoOverview";
import { SeoKeywords } from "./pages/SeoKeywords";
import { SeoPages } from "./pages/SeoPages";
import { CopywritingOverview } from "./pages/CopywritingOverview";
import { CopywritingBriefs } from "./pages/CopywritingBriefs";
import { CopywritingBriefDetail } from "./pages/CopywritingBriefDetail";
import { CrmOverview } from "./pages/CrmOverview";
import { CrmContacts } from "./pages/CrmContacts";
import { CrmDeals } from "./pages/CrmDeals";
import { DesignOverview } from "./pages/DesignOverview";
import { DesignAssets } from "./pages/DesignAssets";
import { Departments } from "./pages/Departments";
import { SoftwareOverview } from "./pages/SoftwareOverview";
import { ResearchOverview } from "./pages/ResearchOverview";
import { ResearchProjects } from "./pages/ResearchProjects";
import { ResearchNotes } from "./pages/ResearchNotes";
import { ResearchLiterature } from "./pages/ResearchLiterature";
import { MspOverview } from "./pages/MspOverview";
import { MspClients } from "./pages/MspClients";
import { MspTickets } from "./pages/MspTickets";
import { Sprints } from "./pages/Sprints";
import { CivilOverview } from "./pages/CivilOverview";
import { CivilProjects } from "./pages/CivilProjects";
import { CivilDrawings } from "./pages/CivilDrawings";
import { CivilSpecs } from "./pages/CivilSpecs";
import { KnowledgeBases } from "./pages/KnowledgeBases";
import { KnowledgeBaseDetail } from "./pages/KnowledgeBaseDetail";
import { MemorySettings } from "./pages/MemorySettings";
import { PluginManager } from "./pages/PluginManager";
import { PluginSettings } from "./pages/PluginSettings";
import { PluginPage } from "./pages/PluginPage";
import { PluginMarketplace } from "./pages/PluginMarketplace";
import { RunTranscriptUxLab } from "./pages/RunTranscriptUxLab";
import { OrgChart } from "./pages/OrgChart";
import { NewAgent } from "./pages/NewAgent";
import { AuthPage } from "./pages/Auth";
import { BoardClaimPage } from "./pages/BoardClaim";
import { CliAuthPage } from "./pages/CliAuth";
import { InviteLandingPage } from "./pages/InviteLanding";
import { AcceptUserInvitePage } from "./pages/AcceptUserInvite";
import { NotFoundPage } from "./pages/NotFound";
import { queryKeys } from "./lib/queryKeys";
import { useCompany } from "./context/CompanyContext";
import { useDialog } from "./context/DialogContext";
import { loadLastInboxTab } from "./lib/inbox";
import { shouldRedirectCompanylessRouteToOnboarding } from "./lib/onboarding-route";

function BootstrapPendingPage({ hasActiveInvite = false }: { hasActiveInvite?: boolean }) {
  return (
    <div className="mx-auto max-w-xl py-10">
      <div className="rounded-lg border border-border bg-card p-6">
        <h1 className="text-xl font-semibold">Instance setup required</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {hasActiveInvite
            ? "No instance admin exists yet. A bootstrap invite is already active. Check your Paperclip startup logs for the first admin invite URL, or run this command to rotate it:"
            : "No instance admin exists yet. Run this command in your Paperclip environment to generate the first admin invite URL:"}
        </p>
        <pre className="mt-4 overflow-x-auto rounded-md border border-border bg-muted/30 p-3 text-xs">
{`pnpm paperclipai auth bootstrap-ceo`}
        </pre>
      </div>
    </div>
  );
}

function CloudAccessGate() {
  const location = useLocation();
  const healthQuery = useQuery({
    queryKey: queryKeys.health,
    queryFn: () => healthApi.get(),
    retry: false,
    refetchInterval: (query) => {
      const data = query.state.data as
        | { deploymentMode?: "local_trusted" | "authenticated"; bootstrapStatus?: "ready" | "bootstrap_pending" }
        | undefined;
      return data?.deploymentMode === "authenticated" && data.bootstrapStatus === "bootstrap_pending"
        ? 2000
        : false;
    },
    refetchIntervalInBackground: true,
  });

  const isAuthenticatedMode = healthQuery.data?.deploymentMode === "authenticated";
  const sessionQuery = useQuery({
    queryKey: queryKeys.auth.session,
    queryFn: () => authApi.getSession(),
    enabled: isAuthenticatedMode,
    retry: false,
  });

  if (healthQuery.isLoading || (isAuthenticatedMode && sessionQuery.isLoading)) {
    return <div className="mx-auto max-w-xl py-10 text-sm text-muted-foreground">Loading...</div>;
  }

  if (healthQuery.error) {
    return (
      <div className="mx-auto max-w-xl py-10 text-sm text-destructive">
        {healthQuery.error instanceof Error ? healthQuery.error.message : "Failed to load app state"}
      </div>
    );
  }

  if (isAuthenticatedMode && healthQuery.data?.bootstrapStatus === "bootstrap_pending") {
    return <BootstrapPendingPage hasActiveInvite={healthQuery.data.bootstrapInviteActive} />;
  }

  if (isAuthenticatedMode && !sessionQuery.data) {
    const next = encodeURIComponent(`${location.pathname}${location.search}`);
    return <Navigate to={`/auth?next=${next}`} replace />;
  }

  return <Outlet />;
}

function boardRoutes() {
  return (
    <>
      <Route index element={<Navigate to="dashboard" replace />} />
      <Route path="dashboard" element={<Dashboard />} />
      <Route path="dashboard/fullscreen" element={<DashboardFullscreen />} />
      <Route path="onboarding" element={<OnboardingRoutePage />} />
      <Route path="companies" element={<Companies />} />
      <Route path="company/settings" element={<CompanySettings />} />
      <Route path="company/settings/models" element={<ModelSettings />} />
      <Route path="company/settings/labels" element={<LabelSettings />} />
      <Route path="company/settings/messaging" element={<MessagingSettings />} />
      <Route path="company/export/*" element={<CompanyExport />} />
      <Route path="company/import" element={<CompanyImport />} />
      <Route path="skills/*" element={<CompanySkills />} />
      <Route path="mcp-servers" element={<McpServers />} />
      <Route path="social-media" element={<SocialMediaOverview />} />
      <Route path="social-media/accounts" element={<SocialMediaAccounts />} />
      <Route path="social-media/posts" element={<SocialMediaPosts />} />
      <Route path="social-media/posts/:postId" element={<SocialMediaPostDetail />} />
      <Route path="seo" element={<SeoOverview />} />
      <Route path="seo/keywords" element={<SeoKeywords />} />
      <Route path="seo/pages" element={<SeoPages />} />
      <Route path="copywriting" element={<CopywritingOverview />} />
      <Route path="copywriting/briefs" element={<CopywritingBriefs />} />
      <Route path="copywriting/briefs/:briefId" element={<CopywritingBriefDetail />} />
      <Route path="crm" element={<CrmOverview />} />
      <Route path="crm/contacts" element={<CrmContacts />} />
      <Route path="crm/contacts/:contactId" element={<CrmContacts />} />
      <Route path="crm/deals" element={<CrmDeals />} />
      <Route path="design" element={<DesignOverview />} />
      <Route path="design/assets" element={<DesignAssets />} />
      <Route path="departments" element={<Departments />} />
      <Route path="software" element={<SoftwareOverview />} />
      <Route path="research" element={<ResearchOverview />} />
      <Route path="research/projects" element={<ResearchProjects />} />
      <Route path="research/notes" element={<ResearchNotes />} />
      <Route path="research/literature" element={<ResearchLiterature />} />
       <Route path="msp" element={<MspOverview />} />
       <Route path="msp/clients" element={<MspClients />} />
       <Route path="msp/tickets" element={<MspTickets />} />
       <Route path="sprints" element={<Sprints />} />
       <Route path="civil" element={<CivilOverview />} />
       <Route path="civil/projects" element={<CivilProjects />} />
       <Route path="civil/drawings" element={<CivilDrawings />} />
       <Route path="civil/specs" element={<CivilSpecs />} />
       <Route path="knowledge" element={<KnowledgeBases />} />
        <Route path="knowledge/:kbId" element={<KnowledgeBaseDetail />} />
        <Route path="memory" element={<MemorySettings />} />
        <Route path="analytics" element={<Analytics />} />
      <Route path="settings" element={<LegacySettingsRedirect />} />
      <Route path="settings/*" element={<LegacySettingsRedirect />} />
      <Route path="plugins/:pluginId" element={<PluginPage />} />
      <Route path="org" element={<OrgChart />} />
      <Route path="agents" element={<Navigate to="/agents/all" replace />} />
      <Route path="agents/all" element={<Agents />} />
      <Route path="agents/active" element={<Agents />} />
      <Route path="agents/paused" element={<Agents />} />
      <Route path="agents/error" element={<Agents />} />
      <Route path="agents/new" element={<NewAgent />} />
      <Route path="agents/:agentId" element={<AgentDetail />} />
      <Route path="agents/:agentId/:tab" element={<AgentDetail />} />
      <Route path="agents/:agentId/runs/:runId" element={<AgentDetail />} />
      <Route path="projects" element={<Projects />} />
      <Route path="projects/archived" element={<ArchivedProjects />} />
      <Route path="projects/:projectId" element={<ProjectDetail />} />
      <Route path="projects/:projectId/overview" element={<ProjectDetail />} />
      <Route path="projects/:projectId/issues" element={<ProjectDetail />} />
      <Route path="projects/:projectId/issues/:filter" element={<ProjectDetail />} />
      <Route path="projects/:projectId/configuration" element={<ProjectDetail />} />
      <Route path="projects/:projectId/budget" element={<ProjectDetail />} />
      <Route path="projects/:projectId/metrics" element={<ProjectDetail />} />
      <Route path="issues" element={<Issues />} />
      <Route path="issues/all" element={<Navigate to="/issues" replace />} />
      <Route path="issues/active" element={<Navigate to="/issues" replace />} />
      <Route path="issues/backlog" element={<Navigate to="/issues" replace />} />
      <Route path="issues/done" element={<Navigate to="/issues" replace />} />
      <Route path="issues/recent" element={<Navigate to="/issues" replace />} />
      <Route path="issues/:issueId" element={<IssueDetail />} />
      <Route path="routines" element={<Routines />} />
      <Route path="routines/:routineId" element={<RoutineDetail />} />
      <Route path="execution-workspaces/:workspaceId" element={<ExecutionWorkspaceDetail />} />
      <Route path="goals" element={<Goals />} />
      <Route path="goals/:goalId" element={<GoalDetail />} />
      <Route path="approvals" element={<Navigate to="/approvals/pending" replace />} />
      <Route path="approvals/pending" element={<Approvals />} />
      <Route path="approvals/all" element={<Approvals />} />
      <Route path="approvals/:approvalId" element={<ApprovalDetail />} />
      <Route path="costs" element={<Costs />} />
      <Route path="activity" element={<Activity />} />
      <Route path="inbox" element={<InboxRootRedirect />} />
      <Route path="inbox/mine" element={<Inbox />} />
      <Route path="inbox/recent" element={<Inbox />} />
      <Route path="inbox/unread" element={<Inbox />} />
      <Route path="inbox/all" element={<Inbox />} />
      <Route path="inbox/new" element={<Navigate to="/inbox/mine" replace />} />
      <Route path="design-guide" element={<DesignGuide />} />
      <Route path="tests/ux/runs" element={<RunTranscriptUxLab />} />
      <Route path=":pluginRoutePath" element={<PluginPage />} />
      <Route path="*" element={<NotFoundPage scope="board" />} />
    </>
  );
}

function InboxRootRedirect() {
  return <Navigate to={`/inbox/${loadLastInboxTab()}`} replace />;
}

function LegacySettingsRedirect() {
  const location = useLocation();
  return <Navigate to={`/instance/settings/general${location.search}${location.hash}`} replace />;
}

function OnboardingRoutePage() {
  const { companies } = useCompany();
  const { openOnboarding } = useDialog();
  const { companyPrefix } = useParams<{ companyPrefix?: string }>();
  const matchedCompany = companyPrefix
    ? companies.find((company) => company.issuePrefix.toUpperCase() === companyPrefix.toUpperCase()) ?? null
    : null;

  const title = matchedCompany
    ? `Add an agent to ${matchedCompany.name}`
    : companies.length > 0
      ? "Start a new company"
      : "Welcome to Paperclip";
  const description = matchedCompany
    ? `Set up a new agent for ${matchedCompany.name} and give it a starter task.`
    : companies.length > 0
      ? "Create another AI company with its own agents, tasks, and projects."
      : "Set up your first AI company, add an agent, and give it something to do.";

  return (
    <div className="mx-auto max-w-xl py-10">
      <div className="rounded-lg border border-border bg-card p-6">
        <h1 className="text-xl font-semibold">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        <div className="mt-4">
          <Button
            onClick={() =>
              matchedCompany
                ? openOnboarding({ initialStep: 2, companyId: matchedCompany.id })
                : openOnboarding()
            }
          >
            {matchedCompany ? "Add Agent" : companies.length > 0 ? "New Company" : "Get Started"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function CompanyRootRedirect() {
  const { companies, selectedCompany, loading } = useCompany();
  const location = useLocation();

  if (loading) {
    return <div className="mx-auto max-w-xl py-10 text-sm text-muted-foreground">Loading...</div>;
  }

  const targetCompany = selectedCompany ?? companies[0] ?? null;
  if (!targetCompany) {
    if (
      shouldRedirectCompanylessRouteToOnboarding({
        pathname: location.pathname,
        hasCompanies: false,
      })
    ) {
      return <Navigate to="/onboarding" replace />;
    }
    return <NoCompaniesStartPage />;
  }

  return <Navigate to={`/${targetCompany.issuePrefix}/dashboard`} replace />;
}

function UnprefixedBoardRedirect() {
  const location = useLocation();
  const { companies, selectedCompany, loading } = useCompany();

  if (loading) {
    return <div className="mx-auto max-w-xl py-10 text-sm text-muted-foreground">Loading...</div>;
  }

  const targetCompany = selectedCompany ?? companies[0] ?? null;
  if (!targetCompany) {
    if (
      shouldRedirectCompanylessRouteToOnboarding({
        pathname: location.pathname,
        hasCompanies: false,
      })
    ) {
      return <Navigate to="/onboarding" replace />;
    }
    return <NoCompaniesStartPage />;
  }

  return (
    <Navigate
      to={`/${targetCompany.issuePrefix}${location.pathname}${location.search}${location.hash}`}
      replace
    />
  );
}

function NoCompaniesStartPage() {
  const { openOnboarding } = useDialog();

  return (
    <div className="mx-auto max-w-xl py-10">
      <div className="rounded-lg border border-border bg-card p-6">
        <h1 className="text-xl font-semibold">Welcome to Paperclip</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Set up your first AI company, add an agent, and give it something to do.
        </p>
        <div className="mt-4">
          <Button onClick={() => openOnboarding()}>Get Started</Button>
        </div>
      </div>
    </div>
  );
}

function BrandingInjector() {
  const brandingQuery = useQuery({
    queryKey: queryKeys.instance.branding,
    queryFn: () => instanceSettingsApi.getBranding(),
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (!brandingQuery.data) return;
    const { siteTitle, faviconUrl, appIconUrl } = brandingQuery.data;

    // Remember original values so we can restore them on cleanup
    const originalTitle = document.title;
    const originalAppleTitle = document.querySelector<HTMLMetaElement>(
      'meta[name="apple-mobile-web-app-title"]',
    )?.content;
    const originalFaviconLinks = Array.from(
      document.querySelectorAll<HTMLLinkElement>("link[rel~='icon']"),
    ).map((el) => el.outerHTML);
    const originalAppleLink = document.querySelector<HTMLLinkElement>("link[rel='apple-touch-icon']");
    const originalAppleHref = originalAppleLink?.href;

    if (siteTitle) {
      document.title = siteTitle;
      const appleTitle = document.querySelector<HTMLMetaElement>(
        'meta[name="apple-mobile-web-app-title"]',
      );
      if (appleTitle) appleTitle.content = siteTitle;
    }

    if (faviconUrl) {
      // Replace ALL existing icon link tags so the browser doesn't prefer
      // a leftover SVG/PNG link over our custom asset URL.
      document.querySelectorAll<HTMLLinkElement>("link[rel~='icon']").forEach((el) => el.remove());
      const link = document.createElement("link");
      link.rel = "icon";
      link.href = faviconUrl;
      document.head.appendChild(link);
    }

    if (appIconUrl) {
      let appleLink = document.querySelector<HTMLLinkElement>("link[rel='apple-touch-icon']");
      if (!appleLink) {
        appleLink = document.createElement("link");
        appleLink.rel = "apple-touch-icon";
        document.head.appendChild(appleLink);
      }
      appleLink.href = appIconUrl;
    }

    return () => {
      // Restore original title
      document.title = originalTitle;
      const appleTitle = document.querySelector<HTMLMetaElement>(
        'meta[name="apple-mobile-web-app-title"]',
      );
      if (appleTitle && originalAppleTitle !== undefined) {
        appleTitle.content = originalAppleTitle;
      }

      // Restore original favicon links if custom was injected
      if (faviconUrl) {
        document.querySelectorAll<HTMLLinkElement>("link[rel~='icon']").forEach((el) => el.remove());
        originalFaviconLinks.forEach((html) => {
          const wrapper = document.createElement("div");
          wrapper.innerHTML = html;
          const link = wrapper.querySelector("link");
          if (link) document.head.appendChild(link);
        });
      }

      // Restore original apple-touch-icon if custom was injected
      if (appIconUrl && originalAppleHref !== undefined) {
        const appleLink = document.querySelector<HTMLLinkElement>("link[rel='apple-touch-icon']");
        if (appleLink) appleLink.href = originalAppleHref;
      }
    };
  }, [brandingQuery.data]);

  return null;
}

const BRAND_OVERRIDE_STYLE_ID = "paperclip-brand-override";

function CompanyBrandInjector() {
  const { selectedCompany } = useCompany();

  useEffect(() => {
    const brandColor = selectedCompany?.brandColor;
    const brandFg = selectedCompany?.brandPrimaryForeground;

    let el = document.getElementById(BRAND_OVERRIDE_STYLE_ID) as HTMLStyleElement | null;

    if (!brandColor) {
      el?.remove();
      return;
    }

    if (!el) {
      el = document.createElement("style");
      el.id = BRAND_OVERRIDE_STYLE_ID;
      document.head.appendChild(el);
    }

    // Fall back to a light foreground when no explicit value is saved
    const fgValue = brandFg ?? "oklch(0.985 0 0)";
    const block = `--primary: ${brandColor}; --primary-foreground: ${fgValue}; --sidebar-primary: ${brandColor}; --sidebar-primary-foreground: ${fgValue};`;
    el.textContent = `:root { ${block} }\n:root.dark { ${block} }\n:root.light { ${block} }`;
  }, [selectedCompany?.brandColor, selectedCompany?.brandPrimaryForeground]);

  return null;
}

export function App() {
  return (
    <>
      <BrandingInjector />
      <CompanyBrandInjector />
      <Routes>
        <Route path="auth" element={<AuthPage />} />
        <Route path="board-claim/:token" element={<BoardClaimPage />} />
        <Route path="cli-auth/:id" element={<CliAuthPage />} />
        <Route path="invite/:token" element={<InviteLandingPage />} />
        <Route path="accept-user-invite/:token" element={<AcceptUserInvitePage />} />

        <Route element={<CloudAccessGate />}>
          <Route index element={<CompanyRootRedirect />} />
          <Route path="onboarding" element={<OnboardingRoutePage />} />
          <Route path="instance" element={<Navigate to="/instance/settings/general" replace />} />
          <Route path="instance/settings" element={<Layout />}>
            <Route index element={<Navigate to="general" replace />} />
            <Route path="general" element={<InstanceGeneralSettings />} />
            <Route path="heartbeats" element={<InstanceSettings />} />
            <Route path="experimental" element={<InstanceExperimentalSettings />} />
            <Route path="notifications" element={<InstanceNotificationsSettings />} />
            <Route path="users" element={<InstanceUsersPage />} />
            <Route path="cli-auth" element={<InstanceCliAuthSettings />} />
            <Route path="plugins" element={<PluginManager />} />
            <Route path="plugins/:pluginId" element={<PluginSettings />} />
            <Route path="marketplace" element={<PluginMarketplace />} />
          </Route>
          <Route path="profile" element={<Layout />}>
            <Route index element={<ProfilePage />} />
          </Route>
          <Route path="companies" element={<UnprefixedBoardRedirect />} />
          <Route path="issues" element={<UnprefixedBoardRedirect />} />
          <Route path="issues/:issueId" element={<UnprefixedBoardRedirect />} />
          <Route path="routines" element={<UnprefixedBoardRedirect />} />
          <Route path="routines/:routineId" element={<UnprefixedBoardRedirect />} />
          <Route path="skills/*" element={<UnprefixedBoardRedirect />} />
          <Route path="settings" element={<LegacySettingsRedirect />} />
          <Route path="settings/*" element={<LegacySettingsRedirect />} />
          <Route path="agents" element={<UnprefixedBoardRedirect />} />
          <Route path="agents/new" element={<UnprefixedBoardRedirect />} />
          <Route path="agents/:agentId" element={<UnprefixedBoardRedirect />} />
          <Route path="agents/:agentId/:tab" element={<UnprefixedBoardRedirect />} />
          <Route path="agents/:agentId/runs/:runId" element={<UnprefixedBoardRedirect />} />
          <Route path="projects" element={<UnprefixedBoardRedirect />} />
          <Route path="projects/:projectId" element={<UnprefixedBoardRedirect />} />
          <Route path="projects/:projectId/overview" element={<UnprefixedBoardRedirect />} />
          <Route path="projects/:projectId/issues" element={<UnprefixedBoardRedirect />} />
          <Route path="projects/:projectId/issues/:filter" element={<UnprefixedBoardRedirect />} />
          <Route path="projects/:projectId/configuration" element={<UnprefixedBoardRedirect />} />
          <Route path="tests/ux/runs" element={<UnprefixedBoardRedirect />} />
          <Route path="mcp-servers" element={<UnprefixedBoardRedirect />} />
          <Route path="analytics" element={<UnprefixedBoardRedirect />} />
          <Route path="social-media" element={<UnprefixedBoardRedirect />} />
          <Route path="social-media/*" element={<UnprefixedBoardRedirect />} />
          <Route path="seo" element={<UnprefixedBoardRedirect />} />
          <Route path="seo/*" element={<UnprefixedBoardRedirect />} />
          <Route path="copywriting" element={<UnprefixedBoardRedirect />} />
          <Route path="copywriting/*" element={<UnprefixedBoardRedirect />} />
          <Route path="crm" element={<UnprefixedBoardRedirect />} />
          <Route path="crm/*" element={<UnprefixedBoardRedirect />} />
          <Route path="design" element={<UnprefixedBoardRedirect />} />
          <Route path="design/*" element={<UnprefixedBoardRedirect />} />
          <Route path="departments" element={<UnprefixedBoardRedirect />} />
          <Route path="software" element={<UnprefixedBoardRedirect />} />
          <Route path="software/*" element={<UnprefixedBoardRedirect />} />
          <Route path="research" element={<UnprefixedBoardRedirect />} />
          <Route path="research/*" element={<UnprefixedBoardRedirect />} />
           <Route path="msp" element={<UnprefixedBoardRedirect />} />
           <Route path="msp/*" element={<UnprefixedBoardRedirect />} />
           <Route path="sprints" element={<UnprefixedBoardRedirect />} />
            <Route path="civil" element={<UnprefixedBoardRedirect />} />
            <Route path="civil/*" element={<UnprefixedBoardRedirect />} />
            <Route path="knowledge" element={<UnprefixedBoardRedirect />} />
            <Route path="knowledge/*" element={<UnprefixedBoardRedirect />} />
           <Route path=":companyPrefix" element={<Layout />}>
            {boardRoutes()}
          </Route>
          <Route path="*" element={<NotFoundPage scope="global" />} />
        </Route>
      </Routes>
      <OnboardingWizard />
    </>
  );
}
