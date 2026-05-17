/**
 * Flat list of app paths mirrored from `src/components/layout/sidebar-config.ts`
 * (main sections, operations, Rec Room sub-links, sidebar config index, and config groups).
 * Keep in sync when navigation changes.
 */
export const APP_NAV_ROUTES: readonly string[] = [
  "/",
  "/operations/agents",
  "/operations/tools",
  "/config",
  "/config/agent",
  "/config/approvals",
  "/config/browser",
  "/config/checkpoints",
  "/config/code_execution",
  "/config/compression",
  "/config/cron",
  "/config/delegation",
  "/config/discord",
  "/config/display",
  "/config/env",
  "/config/hermes_md",
  "/config/human_delay",
  "/config/logging",
  "/config/memory",
  "/config/models",
  "/config/platform_toolsets",
  "/config/privacy",
  "/config/security",
  "/config/session_reset",
  "/config/skills",
  "/config/smart_model_routing",
  "/config/stt",
  "/config/terminal",
  "/config/tts",
  "/config/voice",
  "/config/web",
  "/orchestration/cron",
  "/gateway",
  "/orchestration/hermes-kanban",
  "/logs",
  "/memory",
  "/orchestration/missions",
  "/operations/personalities",
  "/recroom/story-weaver",
  "/recroom/story-weaver/characters",
  "/recroom/story-weaver/create",
  "/recroom/story-weaver/library",
  "/recroom/story-weaver/themes",
  "/sessions",
  "/operations/skills",
];

/** Config hub and YAML/file-backed section editors (subset of `APP_NAV_ROUTES`). */
export const CONFIG_SECTION_ROUTES: readonly string[] = APP_NAV_ROUTES.filter(
  (p) => p === "/config" || p.startsWith("/config/")
);

/** Routes for navigation-matrix (avoids duplicating every `/config/*` visit; see `config-sections.spec.ts`). */
export const APP_MATRIX_ROUTES: readonly string[] = APP_NAV_ROUTES.filter(
  (p) => p === "/config" || !p.startsWith("/config/")
);
