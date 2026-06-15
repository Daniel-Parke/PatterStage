// ═══════════════════════════════════════════════════════════════
// useMissionTemplatesState — template editor/manager UI state
// ═══════════════════════════════════════════════════════════════
//
// Extracted from useMissionsPage (god-hook split). Owns the self-
// contained UI state for the template editor + manager modals: the
// editor field drafts (name/description/icon/color), the "which
// template is being edited" id, the saving flag, and the two modal
// visibility flags with their open/close callbacks.
//
// The template *handlers* (save / create-new / edit / delete) stay in
// useMissionsPage because they also read the composer form fields and
// trigger a data refetch; this hook is just the state container the
// handlers + the page JSX read from. useMissionsPage destructures the
// returned bag so the handler bodies + its public return shape are
// unchanged.

"use client";

import { useCallback, useState } from "react";

export function useMissionTemplatesState() {
  const [showTemplateEditor, setShowTemplateEditor] = useState(false);
  const [showTemplateManager, setShowTemplateManager] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [templateName, setTemplateName] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");
  const [templateIcon, setTemplateIcon] = useState("Zap");
  const [templateColor, setTemplateColor] = useState("cyan");
  const [templateSaving, setTemplateSaving] = useState(false);

  // Open/close siblings for the template-manager modal (the "Edit
  // Templates" button in MissionsList) and the template-editor modal's
  // soft close (X / overlay click). Single-setter `useCallback` + `[]`
  // deps shape — same as the category manager's open/close pair.
  const openTemplateManager = useCallback(() => {
    setShowTemplateManager(true);
  }, []);
  const closeTemplateManager = useCallback(() => {
    setShowTemplateManager(false);
  }, []);
  const closeTemplateEditor = useCallback(() => {
    setShowTemplateEditor(false);
  }, []);

  return {
    showTemplateEditor,
    setShowTemplateEditor,
    showTemplateManager,
    editingTemplateId,
    setEditingTemplateId,
    templateName,
    setTemplateName,
    templateDescription,
    setTemplateDescription,
    templateIcon,
    setTemplateIcon,
    templateColor,
    setTemplateColor,
    templateSaving,
    setTemplateSaving,
    openTemplateManager,
    closeTemplateManager,
    closeTemplateEditor,
  };
}
