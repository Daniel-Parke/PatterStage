"use client";

import { useCallback } from "react";
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
    setEditingId,
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

  // Close the create/edit mission sheet. The same pair of resets
  // (setShowCreate(false) + setEditingId(null)) appeared at 3 call
  // sites — the Sheet's onClose, the MissionComposerActions footer
  // onClose, and the embedded MissionCreateForm onClose. Centralising
  // them here keeps the 3 sites in lockstep if a future "clear form
  // fields" or "dismiss category" reset is added — a single edit here
  // updates all 3.
  const handleCloseCreate = useCallback(() => {
    setShowCreate(false);
    setEditingId(null);
  }, [setShowCreate, setEditingId]);

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
            <Button onClick={() => setShowCreate(true)} size="sm">
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
        onClose={() => setShowCategoryManager(false)}
        categories={categories}
        categoriesLoadError={categoriesLoadError}
        onRefresh={() => void loadCategories()}
        onCreateCategory={handleCreateCategory}
        onUpdate={handleUpdateCategory}
        onDelete={handleDeleteCategory}
      />

      <TemplateManagerModal
        open={showTemplateManager}
        onClose={() => setShowTemplateManager(false)}
        templates={templates}
        categories={categories}
        categoryFilter={categoryFilter}
        onEditTemplate={handleEditTemplate}
        onDeleteTemplate={handleDeleteTemplate}
        onCreateTemplate={handleCreateNewTemplate}
      />

      <TemplateEditorModal
        open={showTemplateEditor}
        onClose={() => setShowTemplateEditor(false)}
        onCancel={() => {
          setShowTemplateEditor(false);
          setEditingTemplateId(null);
        }}
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
