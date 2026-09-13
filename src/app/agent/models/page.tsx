// ═══════════════════════════════════════════════════════════════
// /config/models — registry-backed model + credentials manager
// ═══════════════════════════════════════════════════════════════
//
// Replaces the legacy YAML-direct /config/model editor (deleted in PR 4).
// Two sections:
//   1. My Models  — table of registry rows + Add Model action
//   2. Defaults   — 12-slot grid driving model.* + auxiliary.<task>.*
//                   in ~/.hermes/config.yaml via PR 5's write-through.

"use client";

import { useCallback, useMemo } from "react";
import { Globe, KeyRound, Loader2, Plus, RefreshCw, Settings } from "lucide-react";

import AppPageShell from "@/components/layout/AppPageShell";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import LoadErrorBanner from "@/components/ui/LoadErrorBanner";
import ModelEditor from "@/components/models/ModelEditor";

import ModelsAgentDefaultSection from "@/components/models/ModelsAgentDefaultSection";
import ModelsDriftBanner from "@/components/models/ModelsDriftBanner";
import ModelsFallbackSection from "@/components/models/ModelsFallbackSection";
import ModelsSectionHeader from "@/components/models/ModelsSectionHeader";
import ModelsTableSection from "@/components/models/ModelsTableSection";
import CredentialsPanel from "@/components/models/CredentialsPanel";
import DefaultsGrid from "@/components/models/DefaultsGrid";
import type { DefaultsModelOption } from "@/components/models/DefaultsGrid";
import StatStrip from "@/components/viz/StatStrip";
import type { DonutSegment } from "@/components/viz/Donut";
import type { NeonColor } from "@/components/viz/colors";
import ConceptHint from "@/components/help/ConceptHint";
import type { TaskType } from "@/lib/models/task-types";
import { pluralise } from "@/lib/utils";
import { useModelsPage } from "@/hooks/useModelsPage";
// app/ may consult a module; the editor component may not, so the provider list
// is injected from here (ADR-0005).
import { HERMES_PROVIDERS, KEYLESS_PROVIDERS, envVarForProvider } from "@/modules/hermes/lib/providers";

// Providers a key can actually be stored for. POST /api/credentials refuses a
// provider with nowhere to put one (nous signs in through the agent's CLI
// instead), so offering it in the picker would only earn a 400 the operator
// could do nothing about.
const KEY_PROVIDERS = HERMES_PROVIDERS.filter((p) => Boolean(envVarForProvider(p)));

const PROVIDER_CYCLE: NeonColor[] = ["cyan", "green", "purple", "orange", "pink", "yellow"];

/**
 * Model registry overview: the provider-mix donut and the count tile. Provider
 * colours cycle the neon palette (providers are arbitrary strings). Hidden
 * when the registry is empty. Was its own file; this page is its one reader
 * (C6, T-0143).
 */
function ModelInsights({
  models,
  credentialCount,
}: {
  models: { provider: string }[];
  credentialCount: number;
}) {
  const s = useMemo(() => {
    const byProvider = new Map<string, number>();
    for (const m of models) byProvider.set(m.provider, (byProvider.get(m.provider) ?? 0) + 1);
    const entries = [...byProvider.entries()].sort((a, b) => b[1] - a[1]);
    return { total: models.length, providers: byProvider.size, entries };
  }, [models]);

  if (models.length === 0) return null;
  const segments: DonutSegment[] = s.entries
    .slice(0, 6)
    .map(([label, value], i) => ({ label, value, color: PROVIDER_CYCLE[i % PROVIDER_CYCLE.length] }));

  return (
    <StatStrip
      className="mb-5"
      donut={{ segments, center: s.total, centerSub: "models" }}
      // Models is the number in the donut's centre and Providers is how many
      // arcs it has. Credentials is the footnote (T-0124).
      tiles={[
        { icon: KeyRound, label: "Credentials", value: credentialCount, color: "purple" },
      ]}
    />
  );
}

/** The Task Defaults section: the 12-slot grid under its heading. */
function ModelsTaskDefaultsSection({
  defaults,
  modelOptions,
  busyTaskType,
  onChange,
}: {
  defaults: Record<TaskType, string | null>;
  modelOptions: DefaultsModelOption[];
  busyTaskType: TaskType | null;
  onChange: (taskType: TaskType, modelId: string | null) => Promise<void>;
}) {
  return (
    <section data-section="defaults" className="space-y-4">
      <ModelsSectionHeader icon={Settings} title="Task Defaults" color="purple" iconTone="muted" />
      <DefaultsGrid
        defaults={defaults}
        models={modelOptions}
        onChange={onChange}
        busyTaskType={busyTaskType}
      />
    </section>
  );
}

export default function ModelsPage() {
  const {
    models,
    credentials,
    modelOptions,
    credentialOptions,
    defaults,
    modelReadiness,
    loading,
    settled,
    error,
    drift,
    handleDriftPull,
    handleDriftPush,
    busyDriftLine,
    refreshing,
    busyTaskType,
    fallbackChain,
    fallbackConfig,
    handleFallbackConfigChange,
    fallbackConfigSaving,
    fallbackConfigDirty,
    fallbackConfigError,
    syncingFallback,
    importingFallback,
    editing,
    setEditing,
    editingFallbackEntry,
    editingFallbackUrl,
    setEditingFallbackUrl,
    savingFallbackUrl,
    setEditingFallbackEntry,
    toastElement,
    handleRefresh,
    handlePush,
    handlePull,
    handleSaved,
    handleDelete,
    handleAddCredential,
    addingCredential,
    handleDeleteCredential,
    handleRotateCredential,
    busyCredentialId,
    handleSetDefault,
    handleBulkAuxiliaryChange,
    handleFallbackReorder,
    handleFallbackToggle,
    handleFallbackDelete,
    handleFallbackEdit,
    handleFallbackEditSave,
    handleFallbackAddFromRegistry,
    handleFallbackAddCustom,
    handleSyncFallbackToHermes,
    handleImportFallbackFromConfig,
  } = useModelsPage();

  // openAddModel — opens the ModelEditor in CREATE mode (`setEditing(null)`).
  // The "Add Model" button appears in 2 places: the page header (line 99) and
  // the empty-state CTA inside ModelsTableSection (line 127). Both call sites
  // do exactly the same thing: `() => setEditing(null)`. Centralising into a
  // useCallback with empty deps (useState setters are stable) keeps the 2
  // sites in lockstep if a future "navigate to the Models tab" or "pre-select
  // a credential" extension lands — a single edit here updates both.
  // The 3rd `setEditing(...)` site at line 128 (`onEdit={setEditing}`) is
  // a different shape: it passes a `ModelEditorRecord` (edit mode), not
  // `null` (create mode). Left as a direct binding — it's the canonical
  // "open in edit mode" call, not a duplicate.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- useState setters are stable
  const openAddModel = useCallback(() => setEditing(null), []);

  // closeModelEditor — closes the ModelEditor modal. Sister to
  // `openAddModel`; same useState-setter-stability rationale. The
  // `<ModelEditor onClose={...}>` binding at line 204 is the only call
  // site today (1-setter close-callback). Extracting now keeps the page's
  // callback declarations grouped together (all 3 close-callbacks share
  // the `react-hooks/exhaustive-deps` disable comment + the JSDoc
  // "sister to" pattern) so a future "reset the form state on close" or
  // "fire an analytics event" extension lands in one place.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- useState setters are stable
  const closeModelEditor = useCallback(() => setEditing(undefined), []);
  // closeFallbackModal — closes the FallbackUrlEditModal. Sister to
  // `openAddModel` + `closeModelEditor` (same useState-setter stability
  // rationale). The `onCloseFallbackModal={...}` binding at line 184 is
  // the only call site today (1-setter close-callback). The setter
  // `setEditingFallbackEntry` is exposed from `useModelsPage` as a
  // close-modal shim (it forwards to `setFallbackEdit({ entry: null,
  // url: "", saving: false })`), so the call site here is the canonical
  // "dismiss the modal" form, not a partial-update.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- useState setters are stable
  const closeFallbackModal = useCallback(() => setEditingFallbackEntry(null), []);

  return (
    <AppPageShell
      header={
        <PageHeader
          icon={Globe}
          title="Models"
          // Counts once they are counted. Loading with nothing in hand read
          // "0 models in registry · 0 credentials", which is not a state this
          // install has ever been in (T-0128).
          subtitle={
            loading && models.length === 0 && credentials.length === 0
              ? "The model registry and its credentials"
              : `${models.length} model${pluralise(models.length)} in registry · ${credentials.length} credential${pluralise(credentials.length)}`
          }
          color="purple"
          // No back link: Models is a rail entry, and the rail says where you
          // are. The CONFIG eyebrow named a parent it does not have (T-0125).
          actions={
            <>
              <Button
                variant="secondary"
                color="purple"
                icon={refreshing ? Loader2 : RefreshCw}
                onClick={handleRefresh}
                disabled={refreshing}
                // design-lint-disable-next-line hermes-outside-adapter -- tooltip copy. It names the two files Refresh reads so the operator knows what a refresh will and will not pick up; a button that hid the files it reads would be less honest, not better layered.
                title="Sync models from ~/.hermes/config.yaml and ~/.hermes/.env"
              >
                {refreshing ? "Re-importing…" : "Re-import from config"}
              </Button>
              <Button
                variant="primary"
                color="purple"
                icon={Plus}
                onClick={openAddModel}
              >
                Add Model
              </Button>

            </>
          }
        />
      }
    >
      <div className="space-y-10">
        <Card padding="sm" className="text-micro text-ps-text-muted font-mono">
          <p>
            PatterStage stores mission defaults and the <ConceptHint id="model">model</ConceptHint>{" "}
            registry here. Hermes chat/gateway
            runtime defaults live in each profile&apos;s <strong className="text-ps-text-secondary">config.yaml</strong>{" "}
            (imported by the pull on Agent → Agents, or <code className="text-ps-text-muted">hermes model</code>).
            Seeds never set <code className="text-ps-text-muted">model.default</code>.
          </p>
        </Card>
        {error && <LoadErrorBanner error={error} />}

        {drift && (
          <ModelsDriftBanner
            drift={drift}
            agentDefaultId={defaults.agent}
            onPull={handleDriftPull}
            onPush={handleDriftPush}
            busyLine={busyDriftLine}
          />
        )}

        {/* The spinner is for the first read only. Every write reloads the
            registry, and swapping the body for a spinner on each one closed
            the disclosure the operator had opened and blinked the lists out
            (T-0144). */}
        {!settled ? (
          <LoadingSpinner text="Loading models..." />
        ) : (
          <>
            <ModelInsights models={models} credentialCount={credentials.length} />
            <CredentialsPanel
              credentials={credentials}
              onDelete={handleDeleteCredential}
              onRotate={handleRotateCredential}
              onAdd={handleAddCredential}
              providers={KEY_PROVIDERS}
              adding={addingCredential}
              busyId={busyCredentialId}
            />
            <ModelsTableSection
              models={models}
              defaults={defaults}
              busyTaskType={busyTaskType}
              onAddModel={openAddModel}
              onReimport={handleRefresh}
              reimporting={refreshing}
              onEdit={setEditing}
              onDelete={handleDelete}
              onPush={handlePush}
              onPull={handlePull}
            />

            <ModelsAgentDefaultSection
              models={models}
              modelOptions={modelOptions}
              defaults={defaults}
              readiness={modelReadiness}
              busyTaskType={busyTaskType}
              onBulkAuxiliaryChange={handleBulkAuxiliaryChange}
              onSetDefault={handleSetDefault}
            />

            <ModelsFallbackSection
              fallbackChain={fallbackChain}
              fallbackConfig={fallbackConfig}
              modelOptions={modelOptions}
              busyTaskType={busyTaskType}
              syncingFallback={syncingFallback}
              importingFallback={importingFallback}
              editingFallbackEntry={editingFallbackEntry}
              editingFallbackUrl={editingFallbackUrl}
              savingFallbackUrl={savingFallbackUrl}
              onFallbackConfigChange={handleFallbackConfigChange}
              fallbackConfigSaving={fallbackConfigSaving}
              fallbackConfigDirty={fallbackConfigDirty}
              fallbackConfigError={fallbackConfigError}
              onReorder={handleFallbackReorder}
              onToggle={handleFallbackToggle}
              onDelete={handleFallbackDelete}
              onEdit={handleFallbackEdit}
              onAddFromRegistry={handleFallbackAddFromRegistry}
              onAddCustom={handleFallbackAddCustom}
              onSyncToHermes={handleSyncFallbackToHermes}
              onImportFromConfig={handleImportFallbackFromConfig}
              onFallbackUrlChange={setEditingFallbackUrl}
              onCloseFallbackModal={closeFallbackModal}
              onSaveFallbackUrl={handleFallbackEditSave}
            />

            <ModelsTaskDefaultsSection
              defaults={defaults}
              modelOptions={modelOptions}
              busyTaskType={busyTaskType}
              onChange={handleSetDefault}
            />

          </>
        )}
      </div>

      {editing !== undefined && (
        <ModelEditor
          model={editing}
          credentials={credentialOptions}
          providers={HERMES_PROVIDERS}
          keylessProviders={KEYLESS_PROVIDERS}
          onClose={closeModelEditor}
          onSaved={handleSaved}
        />
      )}

      {toastElement}
    </AppPageShell>
  );
}
