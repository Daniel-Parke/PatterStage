// ═══════════════════════════════════════════════════════════════
// useMissionsPage — composition root for /orchestration/missions
// ═══════════════════════════════════════════════════════════════
//
// This hook owns almost nothing. It holds the two pieces of state that
// every other slice has to read (the create sheet's visibility and the
// mission being edited), composes the focused hooks in dependency
// order, and assembles the single view model the page renders from.
//
// The slices, in the order they are composed:
//   useMissionComposer          form fields, setters, dispatch payload
//   useMissionTemplatesState    template editor/manager drafts + modals
//   useMissionsData             loading, the 15s poll, detail panel,
//                               categories, the ?template= deep link
//   useMissionDispatch          create/update/promote/delete/cancel
//   useMissionTemplateActions   the six template handlers
//   useMissionsFiltering        board filters + derived selectors
//
// Order is load-bearing: the composer's effects must still run before
// the data hook's, and the data hook must exist before the two write
// paths that refetch through it.
//
// MissionRow / MissionDetail moved to src/hooks/missions-page-types.ts
// so the slices can name them without importing this file.

"use client";

import { useCallback, useState } from "react";

import { useToast } from "@/components/ui/Toast";
import { useMissionTemplatesState } from "@/hooks/useMissionTemplatesState";
import { useMissionComposer } from "@/hooks/useMissionComposer";
import { useMissionsData } from "@/hooks/useMissionsData";
import { useMissionDispatch } from "@/hooks/useMissionDispatch";
import { useMissionTemplateActions } from "@/hooks/useMissionTemplateActions";
import { useMissionsFiltering } from "@/hooks/useMissionsFiltering";

export function useMissionsPage() {
  const { showToast, toastElement } = useToast();

  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Close the create/edit mission composer. The same `setEditingId(null)`
  // + `setShowCreate(false)` pair appears at 3 sites — the 2 success
  // branches of `handleCreate` (update + promote) and the page's
  // `handleCloseCreate` (Sheet onClose, MissionComposerActions onClose,
  // MissionCreateForm onClose). Centralising it here keeps the 3 sites
  // in lockstep if a future "clear form fields" or "dismiss category"
  // reset is added — a single edit here updates all 3.
  const closeComposer = useCallback(() => {
    setEditingId(null);
    setShowCreate(false);
  }, []);

  // Open the create mission composer (fresh-create mode, not edit).
  // The page's `<Button onClick={() => setShowCreate(true)}>` "New Mission"
  // header action is the canonical caller — a named callback keeps the
  // action bar's open-mission click in lockstep with `closeComposer`'s
  // close-mission click, and groups the 2 sibling open/close callbacks
  // next to each other. Mirrors the `openAgentCreate` / `closeAgentModal`
  // pattern that session 114 promoted in `cron/page.tsx` (see commit
  // `5f0ec5a` "openCreate/openEdit callbacks"). The 4 `setShowCreate(true)`
  // sites in the slices (handleEdit, handleDuplicateMission,
  // handleTemplateSelect, fetchData's template-apply path) are NOT this
  // callback — they all do additional state mutations (set editing,
  // populate form, etc.) before opening. openCreate is the single-setter
  // "open fresh" path used by the page's "New Mission" button only.
  const openCreate = useCallback(() => {
    setShowCreate(true);
  }, []);

  // Composer form state (every `new*` field) + its setters, the typed
  // field-setter map, the dispatch payload builder, the two form-
  // population helpers, and the three composer-local effects.
  // showCreate/editingId are passed in so the visibility-gated effects
  // (last-category restore, default-agent autofill) can read them.
  const composer = useMissionComposer({ showCreate, editingId });

  // Template editor/manager UI state (drafts + the two modal flags).
  const templateState = useMissionTemplatesState();

  const data = useMissionsData({
    showToast,
    applyTemplateToForm: composer.applyTemplateToForm,
    setShowCreate,
  });

  const dispatch = useMissionDispatch({
    composer,
    missions: data.missions,
    updateMission: data.updateMission,
    fetchData: data.fetchData,
    fetchDetail: data.fetchDetail,
    expandedId: data.expandedId,
    setExpandedId: data.setExpandedId,
    editingId,
    setEditingId,
    setShowCreate,
    closeComposer,
    showToast,
  });

  const templateActions = useMissionTemplateActions({
    composer,
    templateState,
    templates: data.templates,
    fetchData: data.fetchData,
    loadAndApplyTemplate: data.loadAndApplyTemplate,
    showToast,
  });

  const filtering = useMissionsFiltering({
    missions: data.missions,
    templates: data.templates,
    categories: data.categories,
    deepLinkedMissionId: data.deepLinkedMissionId,
  });

  return {
    toastElement,
    loading: data.loading,
    missions: data.missions,
    templates: data.templates,
    fetchData: data.fetchData,
    showCreate,
    setShowCreate,
    editingId,
    setEditingId,
    filter: filtering.filter,
    setFilter: filtering.setFilter,
    search: filtering.search,
    setSearch: filtering.setSearch,
    expandedId: data.expandedId,
    setExpandedId: data.setExpandedId,
    detail: data.detail,
    detailLoading: data.detailLoading,
    promptCollapsed: data.promptCollapsed,
    setPromptCollapsed: data.setPromptCollapsed,
    collapsedColumns: filtering.collapsedColumns,
    setCollapsedColumns: filtering.setCollapsedColumns,
    categoryFilter: filtering.categoryFilter,
    setCategoryFilter: filtering.setCategoryFilter,
    missionCategoryFilter: filtering.missionCategoryFilter,
    setMissionCategoryFilter: filtering.setMissionCategoryFilter,
    categories: data.categories,
    categoriesLoadError: data.categoriesLoadError,
    newCategoryId: composer.newCategoryId,
    setNewCategoryId: composer.setNewCategoryId,
    showCategoryManager: data.showCategoryManager,
    openCategoryManager: data.openCategoryManager,
    closeCategoryManager: data.closeCategoryManager,
    loadCategories: data.loadCategories,
    handleCreateCategory: data.handleCreateCategory,
    handleCreateNewTemplate: templateActions.handleCreateNewTemplate,
    handleUpdateCategory: data.handleUpdateCategory,
    handleDeleteCategory: data.handleDeleteCategory,
    setCategoryId: composer.setCategoryId,
    templateCategoryPills: filtering.templateCategoryPills,
    missionCategoryPills: filtering.missionCategoryPills,
    filteredGrouped: filtering.filteredGrouped,
    filtered: filtering.filtered,
    formState: composer.formState,
    setFormField: composer.setFormField,
    handleCreate: dispatch.handleCreate,
    openCreate,
    closeComposer,
    handleSaveAsTemplate: templateActions.handleSaveAsTemplate,
    overwriteTemplateName: templateActions.overwriteTemplateName,
    missionsLoadError: data.missionsLoadError,
    dispatching: dispatch.dispatching,
    cancellingMissionId: dispatch.cancellingMissionId,
    handleTemplateSelect: templateActions.handleTemplateSelect,
    openTemplateManager: templateState.openTemplateManager,
    closeTemplateManager: templateState.closeTemplateManager,
    showTemplateManager: templateState.showTemplateManager,
    handleEditTemplate: templateActions.handleEditTemplate,
    handleDeleteTemplate: templateActions.handleDeleteTemplate,
    showTemplateEditor: templateState.showTemplateEditor,
    setShowTemplateEditor: templateState.setShowTemplateEditor,
    closeTemplateEditor: templateState.closeTemplateEditor,
    editingTemplateId: templateState.editingTemplateId,
    setEditingTemplateId: templateState.setEditingTemplateId,
    templateName: templateState.templateName,
    setTemplateName: templateState.setTemplateName,
    templateDescription: templateState.templateDescription,
    setTemplateDescription: templateState.setTemplateDescription,
    templateIcon: templateState.templateIcon,
    setTemplateIcon: templateState.setTemplateIcon,
    templateColor: templateState.templateColor,
    setTemplateColor: templateState.setTemplateColor,
    templateSaving: templateState.templateSaving,
    // The template editor own draft (T-0104, D72). The modal used to bind
    // the composer new* fields, so opening it destroyed a half-written
    // mission and saving it wrote whatever the composer was holding.
    templateInstruction: templateState.templateInstruction,
    setTemplateInstruction: templateState.setTemplateInstruction,
    templateContext: templateState.templateContext,
    setTemplateContext: templateState.setTemplateContext,
    templateGoals: templateState.templateGoals,
    setTemplateGoals: templateState.setTemplateGoals,
    templateProfile: templateState.templateProfile,
    setTemplateProfile: templateState.setTemplateProfile,
    templateModel: templateState.templateModel,
    templateProvider: templateState.templateProvider,
    setTemplateModelAndProvider: templateState.setTemplateModelAndProvider,
    templateMissionTime: templateState.templateMissionTime,
    setTemplateMissionTime: templateState.setTemplateMissionTime,
    templateTimeout: templateState.templateTimeout,
    setTemplateTimeout: templateState.setTemplateTimeout,
    templateLocalDirs: templateState.templateLocalDirs,
    setTemplateLocalDirs: templateState.setTemplateLocalDirs,
    templateLocalDirDraft: templateState.templateLocalDirDraft,
    setTemplateLocalDirDraft: templateState.setTemplateLocalDirDraft,
    templateReferences: templateState.templateReferences,
    setTemplateReferences: templateState.setTemplateReferences,
    templateReferenceInput: templateState.templateReferenceInput,
    setTemplateReferenceInput: templateState.setTemplateReferenceInput,
    templateSkills: templateState.templateSkills,
    setTemplateSkills: templateState.setTemplateSkills,
    templateCategoryId: templateState.templateCategoryId,
    setTemplateCategoryId: templateState.setTemplateCategoryId,
    handleTemplateSave: templateActions.handleTemplateSave,
    newInstruction: composer.newInstruction,
    setNewInstruction: composer.setNewInstruction,
    newContext: composer.newContext,
    setNewContext: composer.setNewContext,
    newGoals: composer.newGoals,
    setNewGoals: composer.setNewGoals,
    newOutputFormat: composer.newOutputFormat,
    setNewOutputFormat: composer.setNewOutputFormat,
    newConstraints: composer.newConstraints,
    setNewConstraints: composer.setNewConstraints,
    dispatchAcknowledged: composer.dispatchAcknowledged,
    scheduleDraftError: composer.scheduleDraftError,
    setScheduleDraftError: composer.setScheduleDraftError,
    setDispatchAcknowledged: composer.setDispatchAcknowledged,
    newProfile: composer.newProfile,
    setNewProfile: composer.setNewProfile,
    newModel: composer.newModel,
    newProvider: composer.newProvider,
    setNewModel: composer.setNewModel,
    setNewProvider: composer.setNewProvider,
    setModelAndProvider: composer.setModelAndProvider,
    newMissionTime: composer.newMissionTime,
    setNewMissionTime: composer.setNewMissionTime,
    newTimeout: composer.newTimeout,
    setNewTimeout: composer.setNewTimeout,
    newLocalDirs: composer.newLocalDirs,
    setNewLocalDirs: composer.setNewLocalDirs,
    localDirDraft: composer.localDirDraft,
    setLocalDirDraft: composer.setLocalDirDraft,
    newReferences: composer.newReferences,
    setNewReferences: composer.setNewReferences,
    referenceInput: composer.referenceInput,
    setReferenceInput: composer.setReferenceInput,
    newSkills: composer.newSkills,
    setNewSkills: composer.setNewSkills,
    handleEdit: dispatch.handleEdit,
    handleDelete: dispatch.handleDelete,
    handleCancel: dispatch.handleCancel,
    handleDuplicateMission: dispatch.handleDuplicateMission,
  };
}

export type MissionsPageViewModel = ReturnType<typeof useMissionsPage>;
