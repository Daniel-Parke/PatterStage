"use client";

import { Loader2, Plus, RefreshCw, Rocket } from "lucide-react";
import AppPageShell from "@/components/layout/AppPageShell";
import PageHeader from "@/components/layout/PageHeader";
import AgentSetupNotice from "@/components/agents/AgentSetupNotice";
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
import MissionInsights from "@/components/missions/MissionInsights";
import { mapCategories } from "@/lib/missions/mission-form-utils";

export default function MissionsPage() {
  const vm = useMissionsPage();
  const {
    loading,
    toastElement,
    fetchData,
    showCreate,
    editingId,
    templates,
    showTemplateManager,
    handleEditTemplate,
    handleDeleteTemplate,
    categoryFilter,
    showTemplateEditor,
    editingTemplateId,
    templateName,
    setTemplateName,
    templateDescription,
    setTemplateDescription,
    templateIcon,
    setTemplateIcon,
    templateColor,
    setTemplateColor,
    templateSaving,
    templateInstruction,
    setTemplateInstruction,
    templateContext,
    setTemplateContext,
    templateGoals,
    setTemplateGoals,
    templateProfile,
    setTemplateProfile,
    templateModel,
    templateProvider,
    setTemplateModelAndProvider,
    templateMissionTime,
    setTemplateMissionTime,
    templateTimeout,
    setTemplateTimeout,
    templateLocalDirs,
    setTemplateLocalDirs,
    templateLocalDirDraft,
    setTemplateLocalDirDraft,
    templateReferences,
    setTemplateReferences,
    templateReferenceInput,
    setTemplateReferenceInput,
    templateSkills,
    setTemplateSkills,
    templateCategoryId,
    setTemplateCategoryId,
    handleTemplateSave,
    missions,
    formState,
    setFormField,
    handleCreate,
    handleSaveAsTemplate,
    overwriteTemplateName,
    dispatching,
    dispatchAcknowledged,
    setDispatchAcknowledged,
    scheduleDraftError,
    setScheduleDraftError,
    categories,
    newCategoryId,
    setCategoryId,
    showCategoryManager,
    loadCategories,
    handleCreateCategory,
    handleUpdateCategory,
    handleDeleteCategory,
    categoriesLoadError,
    handleCreateNewTemplate,
  } = vm;

  const handleCloseCreate = vm.closeComposer;

  const handleOpenCreate = vm.openCreate;

  const closeCategoryManager = vm.closeCategoryManager;
  const closeTemplateManager = vm.closeTemplateManager;
  const openCategoryManager = vm.openCategoryManager;
  // One close path. The editor used to have two, a SOFT close that left
  // editingTemplateId set and a HARD one that cleared it, described in a long
  // comment as a deliberate discriminator. It was the defect: a soft close and
  // then Save as Template on an unrelated mission sent action:"update" against
  // whatever had last been open (T-0104, D70). closeTemplateEditor clears it.
  const closeTemplateEditor = vm.closeTemplateEditor;

  // One header, both shells. The loading branch used to render none at all, so
  // the busiest screen in the product opened as an unnamed spinner: no title,
  // no Refresh, no way into the guide until the fetch came back.
  const header = (
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
            className="p-2 rounded-ps-md text-ps-text-muted hover:text-ps-text-secondary hover:bg-ps-surface-raised transition-colors"
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
  );

  if (loading) {
    return (
      <AppPageShell variant="scanlines" header={header}>
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
    <AppPageShell variant="scanlines" header={header}>
      {toastElement}

      {/* Renders nothing when an agent is configured. On an install without
          one, this is the only place the page admits that composing a mission
          here will not dispatch anywhere. */}
      <AgentSetupNotice what="Dispatching a mission" />

      <div className="space-y-6">
        <MissionInsights missions={missions} />
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
            overwriteTemplateName={overwriteTemplateName}
            onClose={handleCloseCreate}
            dispatching={dispatching}
            dispatchAcknowledged={dispatchAcknowledged}
          />
        }
      >
        <div>
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
            onManageCategories={openCategoryManager}
            categoriesLoadError={categoriesLoadError}
            onRetryCategories={() => void loadCategories()}
            onSubmit={handleCreate}
            onSaveAsTemplate={handleSaveAsTemplate}
            overwriteTemplateName={overwriteTemplateName}
            onClose={handleCloseCreate}
            dispatching={dispatching}
            dispatchAcknowledged={dispatchAcknowledged}
            // The acknowledgement mirrors the Dispatch step's open state
            // (T-0043). It starts satisfied because the step starts open;
            // collapsing the choice withdraws it and the gate returns.
            onDispatchOpenChange={(open) => setDispatchAcknowledged(open)}
            scheduleDraftError={scheduleDraftError}
            onScheduleDraftError={setScheduleDraftError}
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
        onCancel={closeTemplateEditor}
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
        categoryId={templateCategoryId}
        onCategoryChange={setTemplateCategoryId}
        onCreateCategory={handleCreateCategory}
        newInstruction={templateInstruction}
        onNewInstructionChange={setTemplateInstruction}
        newContext={templateContext}
        onNewContextChange={setTemplateContext}
        newGoals={templateGoals}
        onNewGoalsChange={setTemplateGoals}
        newProfile={templateProfile}
        onNewProfileChange={setTemplateProfile}
        newModel={templateModel}
        newProvider={templateProvider}
        onModelChange={setTemplateModelAndProvider}
        newMissionTime={templateMissionTime}
        onNewMissionTimeChange={setTemplateMissionTime}
        newTimeout={templateTimeout}
        onNewTimeoutChange={setTemplateTimeout}
        newLocalDirs={templateLocalDirs}
        onNewLocalDirsChange={setTemplateLocalDirs}
        localDirDraft={templateLocalDirDraft}
        onLocalDirDraftChange={setTemplateLocalDirDraft}
        newReferences={templateReferences}
        onNewReferencesChange={setTemplateReferences}
        referenceInput={templateReferenceInput}
        onReferenceInputChange={setTemplateReferenceInput}
        newSkills={templateSkills}
        onNewSkillsChange={setTemplateSkills}
      />
    </AppPageShell>
  );
}
