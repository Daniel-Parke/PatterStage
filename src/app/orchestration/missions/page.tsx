"use client";

import { Loader2, Plus, RefreshCw, Rocket } from "lucide-react";
import AppPageShell from "@/components/layout/AppPageShell";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";
import Sheet from "@/components/ui/Sheet";
import MissionCreateForm, {
  MissionComposerActions,
} from "@/components/missions/MissionCreateForm";
import CategoryManagerModal from "@/components/missions/CategoryManagerModal";
import {
  TemplateEditorModal,
  TemplateManagerModal,
} from "@/components/missions/TemplateModals";
import { useMissionsPage } from "@/hooks/useMissionsPage";
import MissionsList from "@/components/missions/MissionsList";
import { mapCategories } from "@/lib/mission-form-utils";

export default function MissionsPage() {
  const vm = useMissionsPage();
  const {
    loading,
    toastElement,
    fetchData,
    showCreate,
    setShowCreate,
    editingId,
    templates,
    showTemplateManager,
    setShowTemplateManager,
    handleEditTemplate,
    handleDeleteTemplate,
    categoryFilter,
    showTemplateEditor,
    setShowTemplateEditor,
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
    handleTemplateSave,
    newInstruction,
    setNewInstruction,
    newContext,
    setNewContext,
    newGoals,
    setNewGoals,
    newProfile,
    setNewProfile,
    newModel,
    newProvider,
    setModelAndProvider,
    newMissionTime,
    setNewMissionTime,
    newTimeout,
    setNewTimeout,
    newLocalDirs,
    setNewLocalDirs,
    localDirDraft,
    setLocalDirDraft,
    newReferences,
    setNewReferences,
    referenceInput,
    setReferenceInput,
    newSkills,
    setNewSkills,
    missions,
    formState,
    setFormField,
    handleCreate,
    handleSaveAsTemplate,
    dispatching,
    dispatchAcknowledged,
    setDispatchAcknowledged,
    categories,
    newCategoryId,
    setCategoryId,
    showCategoryManager,
    setShowCategoryManager,
    loadCategories,
    handleCreateCategory,
    handleUpdateCategory,
    handleDeleteCategory,
    categoriesLoadError,
    handleCreateNewTemplate,
  } = vm;

  // Close the create/edit mission sheet. The shared `closeComposer`
  // callback lives in the hook (see useMissionsPage.ts) — the 2
  // success branches of `handleCreate` (update + promote) use it
  // too, so a future "clear form fields" or "dismiss category"
  // reset lands in one place. The Sheet's onClose,
  // MissionComposerActions footer onClose, and the embedded
  // MissionCreateForm onClose all funnel through this single
  // reference.
  const handleCloseCreate = vm.closeComposer;

  // Sibling open callback for the action-bar's "New Mission" button.
  // Mirrors the `closeComposer` shape (single-setter, no editing state
  // mutation) — promoted from the inline `() => setShowCreate(true)`
  // so the open/close pair are named siblings in the hook's return
  // value. The 4 internal `setShowCreate(true)` sites in the hook
  // (handleEdit, handleDuplicateMission, handleTemplateSelect,
  // fetchData's template-apply path) are NOT this callback — they all
  // do additional state mutations first. See `openCreate` JSDoc in
  // useMissionsPage.ts.
  const handleOpenCreate = vm.openCreate;

  // Three sibling modal close callbacks — each is a single-setter
  // `() => setShow…(false)` that appears exactly once at the
  // modal's `onClose` prop. Inlining them is fine, but naming
  // them keeps the JSX readable and groups the 3 dismissals next
  // to each other so a future "also reset X state on close"
  // extension lands in one place. The functions are byte-equivalent
  // to the inline form: each just calls its setter with `false`.
  const closeCategoryManager = () => setShowCategoryManager(false);
  const closeTemplateManager = () => setShowTemplateManager(false);
  // The Template Editor has TWO close paths: `onClose` (X / overlay) which
  // is a single-setter SOFT close, and `onCancel` (the Cancel button) which
  // is a 2-setter HARD close that also clears `editingTemplateId`. This
  // mirrors the HARD/SOFT discriminator pattern that the agents and
  // missions modals use — see session-100-list2-cron-modal-setter-pair.md.
  // They are NOT duplicates; they are a deliberate UX discriminator, and
  // a future "migrate to a single setter" PR will break the cancel-then-
  // reopen flow. Keep them as 2 separate callbacks.
  const closeTemplateEditor = () => setShowTemplateEditor(false);
  const cancelTemplateEditor = () => {
    setShowTemplateEditor(false);
    setEditingTemplateId(null);
  };

  if (loading) {
    return (
      <AppPageShell variant="scanlines">
        <div className="flex flex-1 min-h-[50vh] items-center justify-center">
          <Loader2 className="w-8 h-8 text-neon-cyan animate-spin" />
        </div>
      </AppPageShell>
    );
  }

  const sheetTitle = (() => {
    if (!editingId) return "New Mission";
    const m = missions.find((x) => x.id === editingId);
    if (
      m &&
      (m.status === "successful" || m.status === "failed")
    ) {
      return `Re-Dispatch: ${m.name}`;
    }
    return "Edit Mission";
  })();

  return (
    <AppPageShell variant="scanlines">
      {toastElement}

      <PageHeader
        icon={Rocket}
        title="Missions"
        subtitle="Dispatch and track agent missions"
        color="cyan"
        actions={
          <>
            <button
              type="button"
              onClick={fetchData}
              className="p-2 rounded-lg text-white/30 hover:text-white/60 hover:bg-white/5 transition-colors"
              aria-label="Refresh missions"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <Button onClick={handleOpenCreate} size="sm">
              <Plus className="w-3.5 h-3.5" /> New Mission
            </Button>
          </>
        }
      />

      <div className="max-w-screen-xl mx-auto w-full px-4 sm:px-6">
        <MissionsList vm={vm} />
      </div>

      <Sheet
        open={showCreate}
        onClose={handleCloseCreate}
        title={sheetTitle}
        subtitle="Category, task, and dispatch settings"
        footer={
          <MissionComposerActions
            editingId={editingId}
            missions={missions}
            formState={formState}
            onSubmit={handleCreate}
            onSaveAsTemplate={handleSaveAsTemplate}
            onClose={handleCloseCreate}
            dispatching={dispatching}
            dispatchAcknowledged={dispatchAcknowledged}
          />
        }
      >
        <div className="max-w-screen-xl mx-auto w-full px-6 py-5">
          <MissionCreateForm
            embedded
            editingId={editingId}
            missions={missions}
            formState={formState}
            setFormField={setFormField}
            categories={mapCategories(categories)}
            categoryId={newCategoryId}
            onCategoryChange={setCategoryId}
            onCreateCategory={handleCreateCategory}
            onManageCategories={() => setShowCategoryManager(true)}
            categoriesLoadError={categoriesLoadError}
            onRetryCategories={() => void loadCategories()}
            onSubmit={handleCreate}
            onSaveAsTemplate={handleSaveAsTemplate}
            onClose={handleCloseCreate}
            dispatching={dispatching}
            dispatchAcknowledged={dispatchAcknowledged}
            onDispatchOpenChange={(open) => {
              if (open) setDispatchAcknowledged(true);
            }}
          />
        </div>
      </Sheet>

      <CategoryManagerModal
        open={showCategoryManager}
        onClose={closeCategoryManager}
        categories={categories}
        categoriesLoadError={categoriesLoadError}
        onRefresh={() => void loadCategories()}
        onCreateCategory={handleCreateCategory}
        onUpdate={handleUpdateCategory}
        onDelete={handleDeleteCategory}
      />

      <TemplateManagerModal
        open={showTemplateManager}
        onClose={closeTemplateManager}
        templates={templates}
        categories={categories}
        categoryFilter={categoryFilter}
        onEditTemplate={handleEditTemplate}
        onDeleteTemplate={handleDeleteTemplate}
        onCreateTemplate={handleCreateNewTemplate}
      />

      <TemplateEditorModal
        open={showTemplateEditor}
        onClose={closeTemplateEditor}
        onCancel={cancelTemplateEditor}
        editingTemplateId={editingTemplateId}
        templateName={templateName}
        onTemplateNameChange={setTemplateName}
        templateDescription={templateDescription}
        onTemplateDescriptionChange={setTemplateDescription}
        templateIcon={templateIcon}
        onTemplateIconChange={setTemplateIcon}
        templateColor={templateColor}
        onTemplateColorChange={setTemplateColor}
        templateSaving={templateSaving}
        onSave={handleTemplateSave}
        categories={mapCategories(categories)}
        categoryId={newCategoryId}
        onCategoryChange={setCategoryId}
        onCreateCategory={handleCreateCategory}
        newInstruction={newInstruction}
        onNewInstructionChange={setNewInstruction}
        newContext={newContext}
        onNewContextChange={setNewContext}
        newGoals={newGoals}
        onNewGoalsChange={setNewGoals}
        newProfile={newProfile}
        onNewProfileChange={setNewProfile}
        newModel={newModel}
        newProvider={newProvider}
        onModelChange={setModelAndProvider}
        newMissionTime={newMissionTime}
        onNewMissionTimeChange={setNewMissionTime}
        newTimeout={newTimeout}
        onNewTimeoutChange={setNewTimeout}
        newLocalDirs={newLocalDirs}
        onNewLocalDirsChange={setNewLocalDirs}
        localDirDraft={localDirDraft}
        onLocalDirDraftChange={setLocalDirDraft}
        newReferences={newReferences}
        onNewReferencesChange={setNewReferences}
        referenceInput={referenceInput}
        onReferenceInputChange={setReferenceInput}
        newSkills={newSkills}
        onNewSkillsChange={setNewSkills}
      />
    </AppPageShell>
  );
}
