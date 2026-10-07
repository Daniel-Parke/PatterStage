"use client";

import { Loader2, Plus, RefreshCw, Rocket } from "lucide-react";
import AppPageShell from "@/components/layout/AppPageShell";
import PageHeader from "@/components/layout/PageHeader";
import AgentSetupNotice from "@/components/agents/AgentSetupNotice";
import LoadErrorBanner from "@/components/ui/LoadErrorBanner";
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
            onClick={() => void vm.fetchData()}
            className="p-2 rounded-ps-md text-ps-text-muted hover:text-ps-text-secondary hover:bg-ps-surface-raised transition-colors"
            aria-label="Refresh missions"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <Button onClick={vm.openCreate} size="sm" disabled={vm.loading}>
            <Plus className="w-3.5 h-3.5" /> New Mission
          </Button>
        </>
      }
    />
  );

  if (vm.loading) {
    return (
      <AppPageShell variant="scanlines" header={header}>
        <div className="flex flex-1 min-h-[50vh] items-center justify-center">
          <Loader2 className="w-8 h-8 text-neon-cyan animate-spin" />
        </div>
      </AppPageShell>
    );
  }

  const sheetTitle = (() => {
    if (!vm.editingId) return "New Mission";
    const m = vm.missions.find((x) => x.id === vm.editingId);
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
      {vm.toastElement}

      {/* Renders nothing when an agent is configured. On an install without
          one, this is the only place the page admits that composing a mission
          here will not dispatch anywhere. */}
      <AgentSetupNotice what="Dispatching a mission" />

      <div className="space-y-6">
        {vm.templatesLoadError && <LoadErrorBanner error={vm.templatesLoadError} onRetry={() => void vm.loadTemplates()} />}
        {vm.categoriesLoadError && !vm.showCreate && !vm.showCategoryManager && (
          <LoadErrorBanner error={vm.categoriesLoadError} onRetry={() => void vm.loadCategories()} />
        )}
        <MissionInsights missions={vm.missions} />
        <MissionsList vm={vm} />
      </div>

      <Sheet
        open={vm.showCreate}
        onClose={vm.closeComposer}
        title={sheetTitle}
        subtitle="Category, task, and dispatch settings"
        footer={
          <MissionComposerActions
            editingId={vm.editingId}
            missions={vm.missions}
            formState={vm.formState}
            onSubmit={vm.handleCreate}
            onSaveAsTemplate={vm.handleSaveAsTemplate}
            overwriteTemplateName={vm.overwriteTemplateName}
            onClose={vm.closeComposer}
            dispatching={vm.dispatching}
            dispatchAcknowledged={vm.dispatchAcknowledged}
          />
        }
      >
        <div>
          <MissionCreateForm
            embedded
            editingId={vm.editingId}
            missions={vm.missions}
            formState={vm.formState}
            setFormField={vm.setFormField}
            categories={mapCategories(vm.categories)}
            categoryId={vm.newCategoryId}
            onCategoryChange={vm.setCategoryId}
            onCreateCategory={vm.handleCreateCategory}
            onManageCategories={vm.openCategoryManager}
            categoriesLoadError={vm.categoriesLoadError}
            onRetryCategories={() => void vm.loadCategories()}
            onSubmit={vm.handleCreate}
            onSaveAsTemplate={vm.handleSaveAsTemplate}
            overwriteTemplateName={vm.overwriteTemplateName}
            onClose={vm.closeComposer}
            dispatching={vm.dispatching}
            dispatchAcknowledged={vm.dispatchAcknowledged}
            // The acknowledgement mirrors the Dispatch step's open state
            // (T-0043). It starts satisfied because the step starts open;
            // collapsing the choice withdraws it and the gate returns.
            onDispatchOpenChange={(open) => vm.setDispatchAcknowledged(open)}
            scheduleDraftError={vm.scheduleDraftError}
            onScheduleDraftError={vm.setScheduleDraftError}
          />
        </div>
      </Sheet>

      <CategoryManagerModal
        open={vm.showCategoryManager}
        onClose={vm.closeCategoryManager}
        categories={vm.categories}
        categoriesLoadError={vm.categoriesLoadError}
        onRefresh={() => void vm.loadCategories()}
        onCreateCategory={vm.handleCreateCategory}
        onUpdate={vm.handleUpdateCategory}
        onDelete={vm.handleDeleteCategory}
      />

      <TemplateManagerModal
        open={vm.showTemplateManager}
        onClose={vm.closeTemplateManager}
        templates={vm.templates}
        categories={vm.categories}
        categoryFilter={vm.categoryFilter}
        onEditTemplate={vm.handleEditTemplate}
        onDeleteTemplate={vm.handleDeleteTemplate}
        onCreateTemplate={vm.handleCreateNewTemplate}
      />

      <TemplateEditorModal {...vm.templateEditorProps} />
    </AppPageShell>
  );
}
