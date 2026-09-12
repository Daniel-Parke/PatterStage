// ═══════════════════════════════════════════════════════════════
// Hindsight Memory Browser — Browse, search, and store memories
// ═══════════════════════════════════════════════════════════════
// Memories are fetched only when the user clicks Recall (action=recall), not on mount.
// The three tab concerns are owned by their own hooks (useHindsightMemories /
// useHindsightDirectives / useHindsightModels in ./hindsight/); this file is the
// layout shell that wires them to the already-extracted tab + modal components.
// ═══════════════════════════════════════════════════════════════

"use client";

import { useEffect, useState } from "react";
import {
  Search, Plus, Sparkles, List, FileText,
  Settings, RefreshCw,
} from "lucide-react";
import { SearchInput } from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import { HINDSIGHT_DEFAULT_MAX_AGE_DAYS } from "@/lib/memory/hindsight-client";
import type { HealthState, Tab } from "./hindsight/types";
import MemoryInsights from "@/components/memory/MemoryInsights";
import MemoryTab from "./hindsight/MemoryTab";
import DirectivesTab from "./hindsight/DirectivesTab";
import MentalModelsTab from "./hindsight/MentalModelsTab";
import { AddMemoryModal, DirectiveModal, MentalModelModal } from "./hindsight/Modals";
import { setField } from "@/lib/config/set-field";
import { useHindsightMemories } from "./hindsight/useHindsightMemories";
import { useHindsightDirectives } from "./hindsight/useHindsightDirectives";
import { useHindsightModels } from "./hindsight/useHindsightModels";

interface HindsightBrowserProps {
  /**
   * The store's health goes UP, so the page has one place to say it. This
   * component used to render its own banner beside the provider card's
   * warning, which is how a first visit met two notices about one fact
   * (T-0101).
   */
  onHealthChange?: (health: HealthState | null) => void;
  /** A change re-runs the initial load: the card reconnects, the list follows. */
  reloadToken?: number;
}

export default function HindsightBrowser({ onHealthChange, reloadToken = 0 }: HindsightBrowserProps = {}) {
  const { showToast, toastElement } = useToast();
  const [activeTab, setActiveTab] = useState<Tab>("memories");

  // Each tab's state stays behind the hook that owns it. The shell used to
  // restate all three name lists as it destructured them, which is the
  // interface written twice and drifts a rename into three places.
  const memory = useHindsightMemories(showToast);
  const dirs = useHindsightDirectives(showToast, activeTab);
  const models = useHindsightModels(showToast, activeTab);

  const { health, search, loading } = memory;

  useEffect(() => {
    onHealthChange?.(health);
  }, [health, onHealthChange]);

  const { loadRecentMemories } = memory;
  useEffect(() => {
    if (reloadToken > 0) void loadRecentMemories();
  }, [reloadToken, loadRecentMemories]);

  // ── Render ──

  const tabs: Array<{ id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { id: "memories", label: "Memories", icon: List },
    { id: "directives", label: "Directives", icon: FileText },
    { id: "mental-models", label: "Mental Models", icon: Settings },
  ];

  return (
    <div className="pt-2">
      {toastElement}

      {/* Search Bar */}
      {/* One height across the row (T-0125): the box was 43px beside 33px
          buttons, with a "Press Enter to search" line under it that put the
          buttons on a different baseline. Enter still searches, and the
          Recall button beside the box says so. */}
      <div className="mb-6 flex flex-wrap gap-3">
        <div className="min-w-64 flex-1">
          <SearchInput
            value={search}
            onChange={memory.setSearch}
            placeholder="Search memories (semantic search)..."
            accentColor="pink"
            className="h-8"
            onSubmit={() => {
              if (search.trim() && !loading) void memory.runRecall();
            }}
          />
        </div>
        <Button variant="secondary" color="pink" size="md" icon={Search} onClick={() => void memory.runRecall()} disabled={!search.trim() || loading}>
          Recall
        </Button>
        <Button variant="secondary" color="purple" size="md" icon={Sparkles} onClick={() => void memory.handleReflect()} disabled={memory.reflecting || !search.trim()}>
          {memory.reflecting ? "Reflecting..." : "Reflect"}
        </Button>
        <Button variant="primary" color="pink" size="md" icon={Plus} onClick={memory.openAddModal}>
          Add Memory
        </Button>
      </div>

      {/* Memory insights — fresh/stale fact mix + tags for the loaded set */}
      {!memory.loadingInitial && <MemoryInsights memories={memory.memories} hiddenStaleCount={memory.hiddenStaleCount} totalFacts={memory.totalFacts} />}

      {/* Reflect Result */}
      {memory.reflectResult && (
        <Card glow="purple" className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4 text-neon-purple" />
            <span className="text-body font-semibold text-neon-purple">Reflection</span>
          </div>
          <p className="text-body text-ps-text-secondary leading-relaxed">{memory.reflectResult}</p>
        </Card>
      )}

      {/* Tabs */}
      {/* flex-wrap: five tabs are 447px, a phone is 390 (T-0128). */}
      <div className="flex flex-wrap items-center gap-2 mb-4 border-b border-ps-edge-hairline pb-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-ps-md text-body transition-colors ${
              activeTab === tab.id ? "bg-neon-pink/20 text-neon-pink" : "text-ps-text-muted hover:text-ps-text-secondary"
            }`}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
        <div className="flex-1" />
        <Button variant="ghost" size="sm" icon={RefreshCw} onClick={memory.handleRefreshMemories} disabled={loading || memory.loadingInitial}
          title={search.trim() ? "Run the same search again" : "Reload recent memories"}>
          Refresh
        </Button>
      </div>

      {/* Tab Content */}
      {activeTab === "memories" && (
        <MemoryTab
          memories={memory.displayedMemories}
          loading={loading}
          loadingInitial={memory.loadingInitial}
          unreachable={health !== null && health.available === false}
          activeQuery={search.trim() || null}
          onClearQuery={() => {
            memory.setSearch("");
            void loadRecentMemories();
          }}
          showStaleToggle={{
            showStale: memory.showStaleMemories,
            onToggle: () => memory.setShowStaleMemories((v) => !v),
            hiddenCount: memory.hiddenStaleCount,
            thresholdDays: HINDSIGHT_DEFAULT_MAX_AGE_DAYS,
          }}
        />
      )}
      {activeTab === "directives" && (
        <DirectivesTab
          directives={dirs.directives} loading={dirs.loadingDirectives}
          onCreateClick={dirs.openDirectiveModal} onRefresh={dirs.loadDirectives}
          onEdit={dirs.openEditDirective} onToggle={dirs.handleToggleDirective} onDelete={dirs.handleDeleteDirective}
        />
      )}
      {activeTab === "mental-models" && (
        <MentalModelsTab
          models={models.mentalModels} loading={models.loadingModels} refreshingModelId={models.refreshingModelId}
          onCreateClick={models.openModelModal} onRefresh={models.loadModels}
          onEdit={models.openEditModel} onRefreshModel={models.handleRefreshModel} onDelete={models.handleDeleteModel}
        />
      )}

      {/* Modals */}
      <AddMemoryModal
        open={memory.showAddModal} onClose={memory.closeAddModal}
        content={memory.newContent} tags={memory.newTags} adding={memory.adding}
        onContentChange={memory.setNewContent} onTagsChange={memory.setNewTags} onSave={memory.handleAdd}
      />
      <DirectiveModal
        open={dirs.showDirectiveModal} onClose={dirs.closeDirectiveModal}
        isEdit={false}
        name={dirs.dirForm.name} content={dirs.dirForm.content} priority={dirs.dirForm.priority} tags={dirs.dirForm.tags}
        saving={dirs.creatingDirective}
        onNameChange={setField(dirs.setDirForm, "name")}
        onContentChange={setField(dirs.setDirForm, "content")}
        onPriorityChange={setField(dirs.setDirForm, "priority")}
        onTagsChange={setField(dirs.setDirForm, "tags")}
        onSave={dirs.handleCreateDirective}
      />
      <DirectiveModal
        open={!!dirs.editingDirective} onClose={dirs.closeEditDirective} isEdit={true}
        name={dirs.editDirForm.name} content={dirs.editDirForm.content} priority={dirs.editDirForm.priority} tags={dirs.editDirForm.tags}
        saving={dirs.savingDirective}
        onNameChange={setField(dirs.setEditDirForm, "name")}
        onContentChange={setField(dirs.setEditDirForm, "content")}
        onPriorityChange={setField(dirs.setEditDirForm, "priority")}
        onTagsChange={setField(dirs.setEditDirForm, "tags")}
        onSave={dirs.handleSaveDirective}
      />
      <MentalModelModal
        open={models.showModelModal} onClose={models.closeModelModal}
        isEdit={false}
        name={models.modelForm.name} query={models.modelForm.query} tags={models.modelForm.tags}
        saving={models.creatingModel}
        onNameChange={setField(models.setModelForm, "name")}
        onQueryChange={setField(models.setModelForm, "query")}
        onTagsChange={setField(models.setModelForm, "tags")}
        onSave={models.handleCreateModel}
      />
      <MentalModelModal
        open={!!models.editingModel} onClose={models.closeEditModel} isEdit={true}
        name={models.editModelForm.name} query={models.editModelForm.query} tags={models.editModelForm.tags}
        saving={models.savingModel}
        onNameChange={setField(models.setEditModelForm, "name")}
        onQueryChange={setField(models.setEditModelForm, "query")}
        onTagsChange={setField(models.setEditModelForm, "tags")}
        onSave={models.handleSaveModel}
      />
    </div>
  );
}
