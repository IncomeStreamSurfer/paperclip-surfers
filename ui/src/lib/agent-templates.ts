/**
 * Pre-built agent role templates.
 * Each template pre-fills name, title, role, and capabilities in NewAgent.
 */

export interface AgentTemplate {
  key: string;
  name: string;
  title: string;
  role: "ceo" | "general";
  emoji: string;
  capabilities: string;
  description: string;
}

export const AGENT_TEMPLATES: AgentTemplate[] = [
  {
    key: "ceo",
    name: "CEO",
    title: "Chief Executive Officer",
    role: "ceo",
    emoji: "🎯",
    description: "Strategic leader who coordinates all agents and company direction",
    capabilities:
      "Strategic planning and company direction. Coordinate all departments and agents. " +
      "Delegate tasks and manage the org chart. Approve major decisions. " +
      "Monitor company-wide progress and report on KPIs.",
  },
  {
    key: "cto",
    name: "CTO",
    title: "Chief Technology Officer",
    role: "general",
    emoji: "⚙️",
    description: "Owns the technical roadmap, architecture, and engineering team",
    capabilities:
      "Define and own the technical architecture. Lead engineering strategy and roadmap. " +
      "Review and approve major technical decisions. Manage the engineering team. " +
      "Ensure code quality, security, and scalability. Oversee DevOps and infrastructure.",
  },
  {
    key: "cmo",
    name: "CMO",
    title: "Chief Marketing Officer",
    role: "general",
    emoji: "📣",
    description: "Owns brand, demand generation, and go-to-market strategy",
    capabilities:
      "Define and execute marketing strategy. Own brand identity and messaging. " +
      "Drive demand generation and lead acquisition. Oversee content, SEO, and campaigns. " +
      "Measure and report on marketing KPIs.",
  },
  {
    key: "developer",
    name: "Developer",
    title: "Software Developer",
    role: "general",
    emoji: "💻",
    description: "Writes, reviews, and ships code across the stack",
    capabilities:
      "Write clean, well-tested code. Implement features from specifications. " +
      "Fix bugs and resolve technical issues. Participate in code reviews. " +
      "Maintain documentation and follow coding standards.",
  },
  {
    key: "qa",
    name: "QA Engineer",
    title: "QA Engineer",
    role: "general",
    emoji: "🧪",
    description: "Ensures quality through testing, automation, and bug tracking",
    capabilities:
      "Design and execute manual and automated test plans. " +
      "Write integration and end-to-end tests. File and track bug reports. " +
      "Verify fixes and run regression suites. Maintain test documentation.",
  },
  {
    key: "hr",
    name: "HR Manager",
    title: "HR Manager",
    role: "general",
    emoji: "🤝",
    description: "Manages hiring, onboarding, culture, and team health",
    capabilities:
      "Define hiring criteria and manage recruitment pipelines. " +
      "Onboard new agents and team members. Foster company culture and team health. " +
      "Handle performance reviews and conflict resolution. " +
      "Maintain org structure documentation.",
  },
  {
    key: "sales",
    name: "Sales Agent",
    title: "Sales Representative",
    role: "general",
    emoji: "💼",
    description: "Drives outbound prospecting and manages the sales pipeline",
    capabilities:
      "Identify and qualify outbound leads. Conduct discovery calls and demos. " +
      "Manage the CRM and sales pipeline. Draft proposals and close deals. " +
      "Report on pipeline metrics and revenue forecast.",
  },
  {
    key: "marketing",
    name: "Marketing Manager",
    title: "Marketing Manager",
    role: "general",
    emoji: "📊",
    description: "Executes content, campaigns, and social media strategy",
    capabilities:
      "Plan and produce content (blog posts, social media, email). " +
      "Run and optimise paid campaigns. Manage editorial calendar. " +
      "Track engagement metrics and SEO rankings. " +
      "Coordinate with design and sales teams.",
  },
  {
    key: "support",
    name: "Support Agent",
    title: "Customer Support Specialist",
    role: "general",
    emoji: "🎧",
    description: "Handles customer inquiries, tickets, and escalations",
    capabilities:
      "Respond to customer inquiries via chat, email, or ticket system. " +
      "Resolve issues and escalate when needed. Maintain support knowledge base. " +
      "Track satisfaction metrics and identify recurring pain points. " +
      "Coordinate with engineering on bug escalations.",
  },
  {
    key: "finance",
    name: "Finance Analyst",
    title: "Finance Analyst",
    role: "general",
    emoji: "📈",
    description: "Manages budgets, financial reporting, and cost analysis",
    capabilities:
      "Prepare financial reports and forecasts. Track budget vs actuals. " +
      "Analyse cost drivers and identify savings. " +
      "Manage invoicing, payroll processing, and expense reports. " +
      "Ensure compliance with financial policies.",
  },
  {
    key: "designer",
    name: "Designer",
    title: "UI/UX Designer",
    role: "general",
    emoji: "🎨",
    description: "Designs user interfaces and brand assets",
    capabilities:
      "Design intuitive user interfaces and user flows. " +
      "Create brand assets, icons, and visual guidelines. " +
      "Conduct usability reviews and accessibility audits. " +
      "Produce wireframes and prototypes. Collaborate with developers on implementation.",
  },
  {
    key: "devops",
    name: "DevOps Engineer",
    title: "DevOps / Platform Engineer",
    role: "general",
    emoji: "🔧",
    description: "Owns CI/CD, infrastructure, and reliability",
    capabilities:
      "Design and maintain CI/CD pipelines. Manage cloud infrastructure and containers. " +
      "Monitor system health, alerting, and incident response. " +
      "Implement security best practices and access controls. " +
      "Automate repetitive ops tasks and reduce toil.",
  },
];
