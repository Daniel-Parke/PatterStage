// ═══════════════════════════════════════════════════════════════
// TemplateModals — barrel. The two modals were split into
// ./templates/{TemplateManagerModal,TemplateEditorModal}.tsx and the
// shared MissionTemplate type into ./templates/types.ts. This file
// keeps the original import path stable for existing consumers.
// ═══════════════════════════════════════════════════════════════

export type { MissionTemplate } from "./templates/types";
export { TemplateManagerModal } from "./templates/TemplateManagerModal";
export { TemplateEditorModal } from "./templates/TemplateEditorModal";
