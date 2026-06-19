// ═══════════════════════════════════════════════════════════════
// Hindsight Memory Browser — Browse, search, and store memories
// ═══════════════════════════════════════════════════════════════
// Memories are fetched only when the user clicks Recall (action=recall), not on mount.
// The three tab concerns are owned by their own hooks (useHindsightMemories /
// useHindsightDirectives / useHindsightModels in ./hindsight/); this file is the
// layout shell that wires them to the already-extracted tab + modal components.
// ═══════════════════════════════════════════════════════════════

"use client";

import { useState } from "react";
import {
  Search, Plus, Sparkles, List, FileText,
  Settings, RefreshCw,
} from "lucide-react";
import { SearchInput } from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { HINDSIGHT_DEFAULT_MAX_AGE_DAYS } from "@/lib/hindsight-client";
import type { Tab } from "./hindsight/types";
import HealthBanner from "./hindsight/HealthBanner";
import MemoryInsights from "@/components/memory/MemoryInsights";
import MemoryTab from "./hindsight/MemoryTab";
import DirectivesTab from "./hindsight/DirectivesTab";
import MentalModelsTab from "./hindsight/MentalModelsTab";
import { AddMemoryModal, DirectiveModal, MentalModelModal } from "./hindsight/Modals";
import { setField } from "@/lib/set-field";
import { useHindsightMemories } from "./hindsight/useHindsightMemories";
import { useHindsightDirectives } from "./hindsight/useHindsightDirectives";
import { useHindsightModels } from "./hindsight/useHindsightModels";

export default function HindsightBrowser() {
  const { showToast, toastElement } = useToast();
  const [activeTab, setActiveTab] = useState<Tab>("memories");

  const {
    memories,
    loading,
    loadingInitial,
    search,
    setSearch,
    reflectResult,
    reflecting,
    showStaleMemories,
    setShowStaleMemories,
    displayedMemories,
    hiddenStaleCount,
    showAddModal,
    newContent,
    setNewContent,
    newTags,
    setNewTags,
    adding,
    health,
    fetchHealthOnly,
    loadRecentMemories,
    runRecall,
    handleRefreshMemories,
    handleReflect,
    handleAdd,
    openAddModal,
    closeAddModal,
  } = useHindsightMemories(showToast);

  const {
    directives,
    loadingDirectives,
    showDirectiveModal,
    dirForm,
    setDirForm,
    creatingDirective,
    editingDirective,
    editDirForm,
    setEditDirForm,
    savingDirective,
    loadDirectives,
    openDirectiveModal,
    closeDirectiveModal,
    closeEditDirective,
    openEditDirective,
    handleCreateDirective,
    handleToggleDirective,
    handleDeleteDirective,
    handleSaveDirective,
  } = useHindsightDirectives(showToast, activeTab);

  const {
    mentalModels,
    loadingModels,
    showModelModal,
    modelForm,
    setModelForm,
    creatingModel,
    editingModel,
    editModelForm,
    setEditModelForm,
    savingModel,
    refreshingModelId,
    loadModels,
    openModelModal,
    closeModelModal,
    closeEditModel,
    openEditModel,
    handleCreateModel,
    handleRefreshModel,
    handleDeleteModel,
    handleSaveModel,
  } = useHindsightModels(showToast, activeTab);

  // ── Render ──

  const tabs: Array<{ id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { id: "memories", label: "Memories", icon: List },
    { id: "directives", label: "Directives", icon: FileText },
    { id: "mental-models", label: "Mental Models", icon: Settings },
  ];

  return (
    <div className="pt-2">
      {toastElement}

      {health !== null && (
        <HealthBanner
          health={health}
          loadingInitial={loadingInitial}
          onRetry={() => { void loadRecentMemories(); void fetchHealthOnly(); }}
        />
      )}

      {/* Search Bar */}
      <div className="flex gap-3 mb-6">
        <div className="flex-1 flex flex-col gap-1">
          <SearchInput value={search} onChange={setSearch} placeholder="Search memories (semantic search)..." accentColor="pink" />
          <p className="text-xs text-white/30 pl-1">Press Enter to search</p>
        </div>
        <Button variant="secondary" color="pink" size="sm" icon={Search} onClick={() => void runRecall()} disabled={!search.trim() || loading}>
          Recall
        </Button>
        <Button variant="secondary" color="purple" size="sm" icon={Sparkles} onClick={() => void handleReflect()} disabled={reflecting || !search.trim()}>
          {reflecting ? "Reflecting..." : "Reflect"}
        </Button>
        <Button variant="primary" color="pink" size="sm" icon={Plus} onClick={openAddModal}>
          Add Memory
        </Button>
      </div>

      {/* Memory insights — fresh/stale fact mix + tags for the loaded set */}
      {!loadingInitial && <MemoryInsights memories={memories} hiddenStaleCount={hiddenStaleCount} />}

      {/* Reflect Result */}
      {reflectResult && (
        <div className="mb-6 p-4 rounded-xl border border-purple-500/20 bg-purple-500/5">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4 text-purple-400" />
            <span className="text-sm font-semibold text-purple-300">Reflection</span>
          </div>
          <p className="text-sm text-white/70 leading-relaxed">{reflectResult}</p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2 mb-4 border-b border-white/10 pb-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
              activeTab === tab.id ? "bg-pink-500/20 text-pink-300" : "text-white/40 hover:text-white/60"
            }`}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
        <div className="flex-1" />
        <Button variant="ghost" size="sm" icon={RefreshCw} onClick={handleRefreshMemories} disabled={loading || loadingInitial}
          title={search.trim() ? "Run the same search again" : "Reload recent memories"}>
          Refresh
        </Button>
      </div>

      {/* Tab Content */}
      {activeTab === "memories" && (
        <MemoryTab
          memories={displayedMemories}
          loading={loading}
          loadingInitial={loadingInitial}
          showStaleToggle={{
            showStale: showStaleMemories,
            onToggle: () => setShowStaleMemories((v) => !v),
            hiddenCount: hiddenStaleCount,
            thresholdDays: HINDSIGHT_DEFAULT_MAX_AGE_DAYS,
          }}
        />
      )}
      {activeTab === "directives" && (
        <DirectivesTab
          directives={directives} loading={loadingDirectives}
          onCreateClick={openDirectiveModal} onRefresh={loadDirectives}
          onEdit={openEditDirective} onToggle={handleToggleDirective} onDelete={handleDeleteDirective}
        />
      )}
      {activeTab === "mental-models" && (
        <MentalModelsTab
          models={mentalModels} loading={loadingModels} refreshingModelId={refreshingModelId}
          onCreateClick={openModelModal} onRefresh={loadModels}
          onEdit={openEditModel} onRefreshModel={handleRefreshModel} onDelete={handleDeleteModel}
        />
      )}

      {/* Modals */}
      <AddMemoryModal
        open={showAddModal} onClose={closeAddModal}
        content={newContent} tags={newTags} adding={adding}
        onContentChange={setNewContent} onTagsChange={setNewTags} onSave={handleAdd}
      />
      <DirectiveModal
        open={showDirectiveModal} onClose={closeDirectiveModal}
        isEdit={false}
        name={dirForm.name} content={dirForm.content} priority={dirForm.priority} tags={dirForm.tags}
        saving={creatingDirective}
        onNameChange={setField(setDirForm, "name")}
        onContentChange={setField(setDirForm, "content")}
        onPriorityChange={setField(setDirForm, "priority")}
        onTagsChange={setField(setDirForm, "tags")}
        onSave={handleCreateDirective}
      />
      <DirectiveModal
        open={!!editingDirective} onClose={closeEditDirective} isEdit={true}
        name={editDirForm.name} content={editDirForm.content} priority={editDirForm.priority} tags={editDirForm.tags}
        saving={savingDirective}
        onNameChange={setField(setEditDirForm, "name")}
        onContentChange={setField(setEditDirForm, "content")}
        onPriorityChange={setField(setEditDirForm, "priority")}
        onTagsChange={setField(setEditDirForm, "tags")}
        onSave={handleSaveDirective}
      />
      <MentalModelModal
        open={showModelModal} onClose={closeModelModal}
        isEdit={false}
        name={modelForm.name} query={modelForm.query} tags={modelForm.tags}
        saving={creatingModel}
        onNameChange={setField(setModelForm, "name")}
        onQueryChange={setField(setModelForm, "query")}
        onTagsChange={setField(setModelForm, "tags")}
        onSave={handleCreateModel}
      />
      <MentalModelModal
        open={!!editingModel} onClose={closeEditModel} isEdit={true}
        name={editModelForm.name} query={editModelForm.query} tags={editModelForm.tags}
        saving={savingModel}
        onNameChange={setField(setEditModelForm, "name")}
        onQueryChange={setField(setEditModelForm, "query")}
        onTagsChange={setField(setEditModelForm, "tags")}
        onSave={handleSaveModel}
      />
    </div>
  );
}
