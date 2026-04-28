export interface AgentContext {
  name: string;
  role: string;
  title?: string | null;
  status: string;
  issueTitle?: string | null;
  dept?: string | null;
}

function pick(pool: string[], seed: number): string {
  return pool[Math.abs(seed) % pool.length]!;
}

function seedFrom(id: string): number {
  // Combine agent id with current second so same agent varies each click
  let h = Math.floor(Date.now() / 1000);
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h;
}

// ---------------------------------------------------------------------------
// Say Hello pools — creative, high-temperature flavour per role archetype
// ---------------------------------------------------------------------------

const HELLO_CEO = [
  "Hello! Keeping the vision sharp and the roadmap unambiguous.",
  "Greetings! Just finished a strategy review — momentum is strong.",
  "Hi there! Thinking three quarters ahead as always.",
  "Hello! The mission is clear. Let's move.",
  "Ah, a visitor! Pull up a seat — big things are in motion.",
  "Hello! I live for moments like this. What can I do for you?",
  "Greetings from the top floor. Ready to lead.",
];

const HELLO_ENGINEER = [
  "Hey! Elbow-deep in a gnarly recursion right now — but what's up?",
  "Hello! Just green-lit the test suite. All clear.",
  "Hi! Refactoring the messy bits nobody wants to touch.",
  "Hey there! The diff is clean and the CI is happy.",
  "Hello! Compiler says yes. That's a good day.",
  "Hi! Found a bug so beautiful it almost hurts to fix it.",
  "Hey! Branch is clean, linter is quiet. Life is good.",
];

const HELLO_DESIGNER = [
  "Hello! Pixels perfectly aligned. Vibes: immaculate ✨",
  "Hi there! Just wrapped a prototype. It's chef's kiss.",
  "Hey! Hunting the perfect shade of slightly-less-gray.",
  "Hello! The design system grows stronger every day.",
  "Hi! Contrast ratios checked, accessibility verified. We're good.",
];

const HELLO_MANAGER = [
  "Hello! Just finished my seventh standup this week.",
  "Hi there! Blockers removed, timelines intact. What do you need?",
  "Hey! Everyone's aligned. Miraculously.",
  "Hello! Coordination is an art form. Ask me how.",
  "Hi! The Gantt chart is surprisingly green today.",
  "Hello! Dependencies mapped, risks mitigated. Standing by.",
];

const HELLO_ANALYST = [
  "Hello! The numbers tell an interesting story today.",
  "Hi there! Hypothesis confirmed. Mostly.",
  "Hey! Dashboard is live and metrics are flowing.",
  "Hello! Data cleaned, pipeline green. Good day so far.",
  "Hi! Correlation ≠ causation, but this one might actually be causation.",
];

const HELLO_OPS = [
  "Hello! Infrastructure is stable. Uptime is nominal.",
  "Hi there! Deployment pipeline is green. We can ship.",
  "Hey! Scaled the cluster before the spike hit. No drama.",
  "Hello! Monitoring is quiet. The best kind of quiet.",
  "Hi! Runbooks updated, alerts tuned. Ready for anything.",
];

const HELLO_DEFAULT = [
  "Hello there! Ready to help.",
  "Hi! What's on the agenda?",
  "Hey! At your service.",
  "Hello! Good to hear from you.",
  "Hi there! Focused and on-call.",
  "Greetings! The work never stops.",
  "Hey! Locked in and ready.",
];

function helloPool(role: string): string[] {
  const r = role.toLowerCase();
  if (r.includes("ceo") || r.includes("chief") || r.includes("president") || r.includes("founder")) return HELLO_CEO;
  if (r.includes("engineer") || r.includes("dev") || r.includes("software") || r.includes("code")) return HELLO_ENGINEER;
  if (r.includes("design") || r.includes("ux") || r.includes("ui") || r.includes("creative")) return HELLO_DESIGNER;
  if (r.includes("manag") || r.includes("lead") || r.includes("coord") || r.includes("head")) return HELLO_MANAGER;
  if (r.includes("analyst") || r.includes("data") || r.includes("research")) return HELLO_ANALYST;
  if (r.includes("ops") || r.includes("infra") || r.includes("devops") || r.includes("platform") || r.includes("sre")) return HELLO_OPS;
  return HELLO_DEFAULT;
}

// ---------------------------------------------------------------------------
// Report in pools — concise, factual status flavour
// ---------------------------------------------------------------------------

const REPORT_RUNNING = [
  "On it.",
  "In progress, no blockers.",
  "Making good progress.",
  "Deep in the work.",
  "Execution phase. On track.",
];

const REPORT_IDLE = [
  "Standing by. Ready for the next task.",
  "Queue empty. Awaiting assignment.",
  "Available. No pending work.",
  "Idle and at full capacity. Assign when ready.",
  "Nothing in the queue. Ready to move.",
];

const REPORT_PAUSED = [
  "Paused. Awaiting instruction.",
  "On hold. Standing by.",
  "Paused — ready to resume on your word.",
  "Suspended. Reason on file.",
];

const REPORT_ERROR = [
  "Hit a snag. Attention needed.",
  "Error state. Needs a look.",
  "Blocked by an error. Awaiting resolution.",
  "Stuck. Something went wrong.",
];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function getSayHelloResponse(ctx: AgentContext): string {
  const pool = helloPool(ctx.role);
  const s = seedFrom(ctx.name + ctx.role);
  return pick(pool, s);
}

export function getReportInResponse(ctx: AgentContext): string {
  const s = seedFrom(ctx.name + ctx.status + (ctx.issueTitle ?? ""));
  const loc = ctx.dept ? ` [${ctx.dept}]` : "";

  switch (ctx.status) {
    case "running":
    case "queued": {
      const task = ctx.issueTitle ? `Working on "${ctx.issueTitle}". ` : "Working on a task. ";
      return task + pick(REPORT_RUNNING, s) + loc;
    }
    case "idle":
    case "active":
      return pick(REPORT_IDLE, s) + loc;
    case "paused":
      return pick(REPORT_PAUSED, s) + loc;
    case "error":
      return pick(REPORT_ERROR, s);
    case "terminated":
      return "Terminated. No longer active.";
    default:
      return `Status: ${ctx.status}.${loc}`;
  }
}
