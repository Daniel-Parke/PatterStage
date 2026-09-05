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
import ScheduledMissions from "@/components/missions/ScheduledMissions";
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

  // The 3 modal close callbacks (`closeCategoryManager`,
  // `closeTemplateManager`, `closeTemplateEditor`) are now exposed by
  // the hook as siblings of the 3 corresponding `open*` callbacks
  // (`openCategoryManager`, `openTemplateManager`, and the editor's
  // inline open in `handleCreateNewTemplate` / `handleEditTemplate`).
  // This page-local promotion mirrors the `openCreate` / `closeComposer`
  // pair that sessions 98 + 114 + 116 + 118 established, and the
  // `closeCategoryManager` / `openCategoryManager` pair that session
  // 118 codified. The `cancelTemplateEditor` (2-setter HARD close that
  // also clears `editingTemplateId`) is intentionally kept page-local
  // — its 2-setter shape doesn't fit the hook's single-setter close
  // callback contract. The 3 promoted callbacks are byte-equivalent
  // to the pre-migration page-local definitions: each is
  // `useCallback(() => setX(false), [])` (or `[setX]` for the
  // pre-migration form, which has the same runtime behavior — React
  // re-checks the deps; `setX` is stable).
  const closeCategoryManager = vm.closeCategoryManager;
  const closeTemplateManager = vm.closeTemplateManager;
  // Open sibling for `closeCategoryManager`. The `onManageCategories` prop
  // on `<MissionCreateForm>` previously received an inline `() =>
  // setShowCategoryManager(true)` arrow — promoted to a named callback so
  // the open/close pair is named next to each other in the page, matching
  // the `openCreate` / `closeComposer` pair from session 114 + 116 and the
  // `openAgentCreate` / `closeAgentModal` pair from session 114. As of
  // session 118, this callback is exposed by `useMissionsPage` as
  // `vm.openCategoryManager` so the same callback is reused by
  // `MissionsList`'s "Manage categories" button (the 2 inline arrows
  // that used to live at those 2 call sites are now this single named
  // callback). The `useCallback` deps array is `[]` (the setter reference
  // is stable), matching the sibling close callbacks.
  const openCategoryManager = vm.openCategoryManager;
  // One close path. The editor used to have two, a SOFT close that left
  // editingTemplateId set and a HARD one that cleared it, described in a long
  // comment as a deliberate discriminator. It was the defect: a soft close and
  // then Save as Template on an unrelated mission sent action:"update" against
  // whatever had last been open (T-0104, D70). closeTemplateEditor clears it.
  const closeTemplateEditor = vm.closeTemplateEditor;

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
              className="p-2 rounded-lg text-ps-text-muted hover:text-ps-text-secondary hover:bg-white/5 transition-colors"
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

      {/* Renders nothing when an agent is configured. On an install without
          one, this is the only place the page admits that composing a mission
          here will not dispatch anywhere. */}
      <AgentSetupNotice what="Dispatching a mission" />

      <div className="max-w-screen-xl mx-auto w-full px-4 sm:px-6">
        <MissionInsights missions={missions} />
        <MissionsList vm={vm} />
        <ScheduledMissions />
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
