// ═══════════════════════════════════════════════════════════════
// modules/registry.ts — the modules PatterStage ships (ADR-0005)
//
// One list. The sidebar and the e2e route matrix are both DERIVED from it, so
// adding a surface no longer means editing a hardcoded array in core and then
// remembering to mirror it into a test file by hand. (That mirror had already
// drifted: it was missing /laboratory/artifacts.)
//
// `core` is the console itself — the verbs that are PatterStage's own job.
// Everything else is a module, including the Hermes surface, which is what makes
// the framework-agnostic claim testable rather than aspirational: a boundary
// check can assert that nothing outside the hermes module knows Hermes' layout.
// ═══════════════════════════════════════════════════════════════

import type { ProductModule } from "./types";
import { moduleRoutes } from "./types";

/**
 * The console. Dispatch, schedule, gate and watch, plus the transcript and log
 * surfaces those verbs produce. Never gated by a flag.
 */
const coreModule: ProductModule = {
  id: "core",
  title: "Console",
  nav: [
    {
      label: "Main",
      links: [
        { icon: "Zap", label: "Dashboard", href: "/", color: "cyan" },
        { icon: "Clock", label: "Sessions", href: "/sessions", color: "orange" },
        { icon: "Database", label: "Memory", href: "/memory", color: "pink" },
        { icon: "ScrollText", label: "Logs", href: "/logs", color: "cyan" },
      ],
    },
    {
      label: "Orchestration",
      links: [
        { icon: "Rocket", label: "Missions", href: "/orchestration/missions", color: "cyan" },
        {
          icon: "Workflow",
          label: "Composer",
          href: "/orchestration/composer",
          color: "purple",
          featureFlag: "composer",
        },
        { icon: "Terminal", label: "Scripts", href: "/orchestration/scripts", color: "cyan" },
        { icon: "MessageCircle", label: "Chat", href: "/orchestration/chat", color: "cyan" },
      ],
    },
  ],
};

/**
 * The Hermes control plane: the agent's own configuration surfaces.
 *
 * ADR-0002 keeps PatterStage's run engine but makes Hermes one framework behind
 * the AgentRuntime port. Everything Hermes-shaped belongs in here.
 */
const hermesModule: ProductModule = {
  id: "hermes",
  title: "Hermes",
  nav: [
    {
      label: "Operations",
      links: [
        { icon: "Bot", label: "Agents", href: "/operations/agents", color: "purple" },
        { icon: "FileText", label: "Skills", href: "/operations/skills", color: "green" },
        { icon: "Wrench", label: "Tools", href: "/operations/tools", color: "purple" },
        { icon: "Sparkles", label: "Personalities", href: "/operations/personalities", color: "purple" },
      ],
    },
  ],
  configPinned: [
    { icon: "Globe", label: "Models", href: "/config/models", color: "purple" },
    { icon: "Cpu", label: "HERMES.md", href: "/config/hermes_md", color: "cyan" },
    { icon: "Lock", label: "Environment", href: "/config/env", color: "orange" },
  ],
  configGroups: [
    {
      label: "Core",
      defaultOpen: false,
      links: [
        { icon: "Cpu", label: "Agent", href: "/config/agent", color: "cyan" },
        { icon: "RotateCcw", label: "Seed", href: "/config/seed", color: "cyan" },
        { icon: "Activity", label: "Display", href: "/config/display", color: "green" },
        { icon: "Layers", label: "Memory", href: "/config/memory", color: "pink" },
      ],
    },
    {
      label: "Infrastructure",
      links: [
        { icon: "Terminal", label: "Terminal", href: "/config/terminal", color: "orange" },
        { icon: "HardDrive", label: "Compression", href: "/config/compression", color: "cyan" },
        { icon: "Globe2", label: "Browser", href: "/config/browser", color: "green" },
        { icon: "Zap", label: "Checkpoints", href: "/config/checkpoints", color: "cyan" },
        { icon: "Code", label: "Code Execution", href: "/config/code_execution", color: "green" },
        { icon: "ScrollText", label: "Logging", href: "/config/logging", color: "green" },
      ],
    },
    {
      label: "Security",
      links: [
        { icon: "Shield", label: "Security", href: "/config/security", color: "cyan" },
        { icon: "Lock", label: "Privacy", href: "/config/privacy", color: "cyan" },
        { icon: "ShieldCheck", label: "Approvals", href: "/config/approvals", color: "purple" },
      ],
    },
    {
      label: "Voice & Audio",
      links: [
        { icon: "AudioLines", label: "Text-to-Speech", href: "/config/tts", color: "pink" },
        { icon: "Mic", label: "Speech-to-Text", href: "/config/stt", color: "purple" },
        { icon: "Volume2", label: "Voice", href: "/config/voice", color: "pink" },
      ],
    },
    {
      label: "Automation",
      links: [
        { icon: "GitBranch", label: "Delegation", href: "/config/delegation", color: "green" },
        { icon: "ListTodo", label: "Cron", href: "/config/cron", color: "orange" },
        { icon: "RotateCcw", label: "Session Reset", href: "/config/session_reset", color: "orange" },
        { icon: "FileText", label: "Skills", href: "/config/skills", color: "green" },
      ],
    },
    {
      label: "Integrations",
      links: [
        { icon: "MessageCircle", label: "Discord", href: "/config/discord", color: "purple" },
        { icon: "Activity", label: "Streaming", href: "/config/streaming", color: "cyan" },
        { icon: "Network", label: "Web", href: "/config/web", color: "green" },
        { icon: "Settings2", label: "Platform Toolsets", href: "/config/platform_toolsets", color: "purple" },
        { icon: "GitBranch", label: "Smart Routing", href: "/config/smart_model_routing", color: "purple" },
        { icon: "Clock", label: "Human Delay", href: "/config/human_delay", color: "orange" },
      ],
    },
  ],
};

/** Measurement and research surfaces. */
const laboratoryModule: ProductModule = {
  id: "laboratory",
  title: "Laboratory",
  nav: [
    {
      label: "Laboratory",
      links: [
        { icon: "BarChart3", label: "Insights", href: "/laboratory/insights", color: "green" },
        { icon: "Telescope", label: "Deep Research", href: "/laboratory/research", color: "cyan" },
        { icon: "FileStack", label: "Artifacts", href: "/laboratory/artifacts", color: "orange" },
      ],
    },
  ],
};

/**
 * Rec Room: creative work to do while your agent is working. Story Weaver is the
 * first of several, and this module is the acceptance test for the seam — if the
 * next Rec Room app needs no change to core, ADR-0005 has worked.
 */
const recRoomModule: ProductModule = {
  id: "rec-room",
  title: "Rec Room",
  nav: [
    {
      label: "Rec Room",
      links: [
        {
          icon: "BookOpen",
          label: "Story Weaver",
          href: "/recroom/story-weaver",
          color: "purple",
          subLinks: [
            { label: "Library", href: "/recroom/story-weaver/library" },
            { label: "Create", href: "/recroom/story-weaver/create" },
            { label: "Characters", href: "/recroom/story-weaver/characters" },
            { label: "Themes", href: "/recroom/story-weaver/themes" },
          ],
        },
      ],
    },
  ],
};

/** Registration order is display order. */
export const MODULES: readonly ProductModule[] = [
  coreModule,
  hermesModule,
  laboratoryModule,
  recRoomModule,
];

export function getModule(id: string): ProductModule | undefined {
  return MODULES.find((m) => m.id === id);
}

/**
 * Every route every module contributes, plus the config index itself.
 * Deduplicated and sorted so the e2e matrix is stable across reorderings.
 */
export function allModuleRoutes(): string[] {
  const routes = new Set<string>(["/config"]);
  for (const mod of MODULES) for (const route of moduleRoutes(mod)) routes.add(route);
  return [...routes].sort();
}
