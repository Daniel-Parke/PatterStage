// ═══════════════════════════════════════════════════════════════
// Tools — per-profile platform_toolsets (SQLite → config.yaml)
//
// One picker, in the header (T-0125). The profile was a card of its own down
// the left of the toolsets panel: 288px of column under a single select, 182px
// shorter than the grid beside it, the largest sibling spread on any screen.
// The picker is the header's now, as on Agents and Skills, and the grid has
// the width. The strip went too: enabled, disabled and the catalogue size were
// the donut's arcs and centre, and the subtitle says the one thing it said.
// ═══════════════════════════════════════════════════════════════

"use client";

import { sectionHeadingClasses } from "@/lib/theme";
import { useState, useEffect, useCallback } from "react";
import {
  Wrench,
  Info,
  RefreshCw,
  Upload,
  Download,
  Check,
} from "lucide-react";
import AppPageShell from "@/components/layout/AppPageShell";
import PageHeader from "@/components/layout/PageHeader";
import PageLoading from "@/components/ui/PageLoading";
import Button from "@/components/ui/Button";
import LoadErrorBanner from "@/components/ui/LoadErrorBanner";
import ProfilePicker from "@/components/ui/ProfilePicker";
import { Textarea } from "@/components/ui/field";
import { LastResult, useToast } from "@/components/ui/Toast";
import { API_FETCH_BULK_TIMEOUT_MS } from "@/lib/api-fetch";
import { runWrite } from "@/lib/api-write";
import { useApiResource } from "@/hooks/useApiResource";
import { profileSyncBody } from "@/lib/profile-sync-body";
import type { PlatformToolsets } from "@/modules/hermes/lib/profile-config-builder";
import type { AgentProfile } from "@/types/console";
import {
  HERMES_CONFIGURABLE_TOOLSETS,
  HERMES_PLATFORMS,
} from "@/modules/hermes/lib/toolset-catalog";
import {
  expandUnifiedToAllPlatforms,
  unionToolsetsFromPlatforms,
} from "@/modules/hermes/lib/toolset-unify";
import { bundleCovering } from "@/modules/hermes/lib/toolset-coverage";
import { Panel } from "@/components/dashboard/Panel";
import ToolsetReferenceTable from "@/components/tools/ToolsetReferenceTable";
import ConceptHint from "@/components/help/ConceptHint";
import { useProfiles } from "@/hooks/useProfiles";
import { useSelectedProfile } from "@/hooks/useSelectedProfile";

/** What the toolsets read says, once the envelope is unwrapped. */
interface ToolsetsRead {
  platformToolsets: PlatformToolsets;
  unifiedEnabled: string[];
  platformsDiverged: boolean;
  source: string | null;
}

/**
 * A warning callout above the grid: something the operator should know
 * before they save, said in the warning tint. Three of them shared this
 * chrome by hand; the pending-profile one now carries its buttons in the
 * same box (C6, T-0143).
 */
function WarningNotice({ icon, children }: { icon?: boolean; children: React.ReactNode }) {
  return (
    // design-lint-disable-next-line no-inline-card-chrome -- a warning callout, not a surface: the warning border and wash are the message, and Card cannot carry them (its own hairline border would fight the warning one).
    <div className="mb-4 flex items-start gap-2 rounded-ps-md border border-semantic-warning/30 bg-semantic-warning/10 p-3">
      {icon && <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-semantic-warning" aria-hidden="true" />}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

export default function ToolsPage() {
  // Shared with Agents and Skills. Three pickers in three useStates meant three
  // subjects for one word (T-0113).
  const [selectedProfile, setSelectedProfile] = useSelectedProfile();
  const { data: profiles, refetch: refetchProfiles } = useProfiles();
  const profileName = profiles?.find((p) => p.id === selectedProfile)?.name ?? selectedProfile;
  const [toolsetsJson, setToolsetsJson] = useState("{}");
  const [savingToolsets, setSavingToolsets] = useState(false);
  const [syncing, setSyncing] = useState<"pull" | "push" | null>(null);
  const [unifiedEnabled, setUnifiedEnabled] = useState<string[]>([]);
  const [showAdvancedJson, setShowAdvancedJson] = useState(false);
  // The JSON has been typed into. It is the payload from then until it is
  // saved or discarded: toggling a chip used to overwrite it and hiding the
  // panel used to drop it, both without a word (T-0103, D82).
  const [jsonDirty, setJsonDirty] = useState(false);
  // A profile the operator asked for while changes were unsaved (D84).
  const [pendingProfile, setPendingProfile] = useState<string | null>(null);
  // Read off the profiles the page already has, rather than a second raw
  // read of /api/agent/profiles on every mount (T-0129).
  const profileSyncStatus: AgentProfile["syncStatus"] | null =
    profiles?.find((p) => p.id === selectedProfile)?.syncStatus ?? null;
  const { showToast, toastElement, lastResult } = useToast();

  // The profile's toolsets, keyed on the profile: a switch is a first read of
  // another profile's list, and a reload after a save keeps the grid on
  // screen (C6, T-0143). A payload with nothing in it is an empty policy.
  const toolsets = useApiResource<ToolsetsRead>(`/api/agent/profiles/${selectedProfile}/toolsets`, {
    select: (payload) => {
      const p = (payload ?? {}) as {
        platformToolsets?: PlatformToolsets;
        unifiedEnabled?: string[];
        platformsDiverged?: unknown;
        source?: string | null;
      };
      const loaded = p.platformToolsets ?? {};
      return {
        platformToolsets: loaded,
        unifiedEnabled: p.unifiedEnabled ?? unionToolsetsFromPlatforms(loaded),
        platformsDiverged: Boolean(p.platformsDiverged),
        source: p.source ?? null,
      };
    },
    errorMessage: "Failed to load toolsets",
  });
  const loadingToolsets = !toolsets.settled;
  // What the last read gave us, so "changed" is a fact rather than a guess.
  const loadedEnabled = toolsets.data?.unifiedEnabled ?? [];
  const platformsDiverged = toolsets.data?.platformsDiverged ?? false;
  const toolsetsSource = toolsets.data?.source ?? null;

  // The editable copy of the read: the chips and the JSON start as what the
  // profile has, and a read that lands anew (a profile switch, a reload
  // after a save or a pull) is the new starting point. The read's data keeps
  // its identity while its content is unchanged, so a refetch that brings
  // back the same policy leaves an unsaved edit alone.
  useEffect(() => {
    if (!toolsets.data) return;
    setUnifiedEnabled(toolsets.data.unifiedEnabled);
    setToolsetsJson(JSON.stringify(toolsets.data.platformToolsets, null, 2));
    setJsonDirty(false);
  }, [toolsets.data]);

  const { refetch: refetchToolsets } = toolsets;
  const loadToolsets = useCallback(async () => {
    await refetchToolsets();
  }, [refetchToolsets]);

  // Both reads, for a pull or push that may have changed the sync status of
  // the active profile. A local save reloads only the toolsets: the sync
  // status moves only when Hermes disk is touched. No effect depends on this
  // any more (the mount read is the hook's), so it may depend on the
  // profiles' refetch directly.
  const reloadAll = useCallback(async () => {
    await loadToolsets();
    await refetchProfiles();
  }, [loadToolsets, refetchProfiles]);

  const toggleUnifiedToolset = (toolsetId: string) => {
    // A covered toolset is already on, through the bundle. Adding it as its
    // own entry is exactly what the write path removes again.
    if (jsonDirty || bundleCovering(unifiedEnabled, toolsetId)) return;
    setUnifiedEnabled((prev) => {
      const next = [...prev];
      const idx = next.indexOf(toolsetId);
      if (idx >= 0) next.splice(idx, 1);
      else next.push(toolsetId);
      const sorted = [...new Set(next)].sort();
      const expanded = expandUnifiedToAllPlatforms(sorted);
      setToolsetsJson(JSON.stringify(expanded, null, 2));
      return sorted;
    });
  };

  const isUnifiedEnabled = (toolsetId: string): boolean => unifiedEnabled.includes(toolsetId);

  const saveToolsets = () => {
    let payload: PlatformToolsets;
    if (showAdvancedJson || jsonDirty) {
      const parsed = JSON.parse(toolsetsJson) as unknown;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        showToast("Invalid JSON object", "error");
        return Promise.resolve();
      }
      payload = parsed as PlatformToolsets;
    } else {
      payload = expandUnifiedToAllPlatforms(unifiedEnabled);
    }
    return runWrite({
      setBusy: setSavingToolsets,
      showToast,
      url: `/api/agent/profiles/${selectedProfile}/toolsets`,
      method: "PUT",
      body: { platformToolsets: payload },
      successMessage: "Toolsets saved and pushed to Hermes",
      errorMessage: "Failed to save toolsets",
      onSuccess: async () => {
        // The JSON is what was saved, so it is no longer ahead of the profile,
        // even when the reload brings back a policy identical to the last.
        setJsonDirty(false);
        await loadToolsets();
      },
    });
  };

  const pullFromHermes = (mode: "pull" | "push") => {
    const setBusy = (busy: boolean) => setSyncing(busy ? mode : null);
    const successMessage = mode === "pull" ? "Pulled toolsets from Hermes" : (
      selectedProfile === "default"
        ? "Pushed profile to Hermes. Model defaults re-applied to config.yaml."
        : "Pushed profile to Hermes"
    );
    return runWrite({
      setBusy,
      showToast,
      url: `/api/agent/profiles/sync/${mode}`,
      // Bulk: work scales with the install, not the request (T-0047).
      timeoutMs: API_FETCH_BULK_TIMEOUT_MS,
      body: profileSyncBody(selectedProfile),
      successMessage,
      errorMessage: mode === "pull" ? "Pull failed" : "Push failed",
      onSuccess: reloadAll,
      // /api/agent/profiles/sync/* throw on failure (return 500), they
      // don't return {data: {success: false}}; rely on the catch path.
      checkSuccess: false,
    });
  };

  // What the profile HAS, which is what the last read returned. The counters
  // used to report `unifiedEnabled`, the pending choice, so a toggle moved the
  // header before anything was written and the screen described a state the
  // agent had never been given (T-0113).
  const enabledCount = loadedEnabled.length;

  const listsDiffer =
    unifiedEnabled.length !== loadedEnabled.length ||
    unifiedEnabled.some((id) => !loadedEnabled.includes(id));
  const toolsetsDirty = jsonDirty || listsDiffer;

  const requestProfile = (next: string) => {
    if (next === selectedProfile) return;
    if (toolsetsDirty) {
      setPendingProfile(next);
      return;
    }
    setSelectedProfile(next);
  };

  const discardAndSwitch = () => {
    const next = pendingProfile;
    setPendingProfile(null);
    if (next) setSelectedProfile(next);
  };

  // The toolsets a bundle is already providing, named once under the grid
  // rather than repeated on every chip.
  const coveredLabels = HERMES_CONFIGURABLE_TOOLSETS
    .filter((t) => bundleCovering(unifiedEnabled, t.id) !== null)
    .map((t) => t.label);

  const discardJsonEdits = () => {
    setJsonDirty(false);
    setToolsetsJson(JSON.stringify(expandUnifiedToAllPlatforms(unifiedEnabled), null, 2));
  };

  const catalogueSize = HERMES_CONFIGURABLE_TOOLSETS.length;

  return (
    <AppPageShell
      header={
        <PageHeader
          icon={Wrench}
          subtitle={
            loadingToolsets
              ? "Loading profile toolsets…"
              : `${enabledCount} of ${catalogueSize} toolsets enabled for ${profileName}, fanned out to ${HERMES_PLATFORMS.length} platforms${
                  toolsetsDirty ? " · changes not saved yet" : ""
                }`
          }
          color="orange"
          actions={
            // The picker and the one primary action. Pull and Push act on the
            // grid and sit beside it; four controls up here clipped the
            // subtitle to 292px, which is where the count lives.
            <div className="flex flex-wrap items-center justify-end gap-2">
              <ProfilePicker value={selectedProfile} onChange={requestProfile} />
              {/* The page has always known this: `toolsetsDirty` guarded a profile
                  switch and was rendered nowhere, so the only way to learn that
                  the grid was ahead of the profile was to try to leave. */}
              {toolsetsDirty && !loadingToolsets && (
                <span className="flex items-center gap-1 font-mono text-micro text-semantic-warning">
                  <Info className="h-3 w-3" aria-hidden="true" />
                  Unsaved changes
                </span>
              )}
              <Button
                variant="primary"
                color="orange"
                size="md"
                icon={savingToolsets ? undefined : RefreshCw}
                onClick={() => void saveToolsets()}
                disabled={savingToolsets || loadingToolsets}
              >
                {savingToolsets ? "Saving…" : "Save & push toolsets"}
              </Button>
            </div>
          }
        />
      }
    >
      {toastElement}
      <div>
        <LastResult result={lastResult} />
        {profileSyncStatus === "drift" && (
          <WarningNotice icon>
            <p className="text-body text-semantic-warning/90">
              Toolset policy on disk differs from PatterStage (format or values).{" "}
              <strong>Pull from Hermes</strong> imports disk into SQLite;{" "}
              <strong>Save &amp; push toolsets</strong> or <strong>Push</strong> writes canonical{" "}
              <code className="text-ps-text-muted">config.yaml</code> to{" "}
              <code className="text-ps-text-muted">~/.hermes</code>.
            </p>
          </WarningNotice>
        )}
        {profileSyncStatus === "error" && (
          <LoadErrorBanner error="Last sync failed. Check gateway logs, then retry Pull or Push." />
        )}
        {/* The read contract (T-0096, D22): a failed toolsets read is this,
            with a Retry, and the grid under it is not an empty policy. */}
        {toolsets.error && (
          <LoadErrorBanner error={toolsets.error} onRetry={() => void loadToolsets()} />
        )}
        {platformsDiverged && (
          <WarningNotice icon>
            <p className="text-body text-semantic-warning/90">
              Platforms have different toolsets on disk. The grid below shows the union.{" "}
              <strong>Save &amp; push</strong> applies one list to all gateways (like{" "}
              <code className="text-ps-text-muted">hermes tools</code> configure all).
            </p>
          </WarningNotice>
        )}
        {pendingProfile && (
          <WarningNotice>
            <p className="text-body text-ps-text-primary">
              You have unsaved toolset changes on this profile.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button variant="ghost" size="sm" color="orange" onClick={discardAndSwitch}>
                Discard changes
              </Button>
              <Button
                variant="primary"
                size="sm"
                color="orange"
                onClick={() => setPendingProfile(null)}
              >
                Keep editing
              </Button>
            </div>
          </WarningNotice>
        )}

        {/* Was a hand-rolled copy of the accented panel, down to the class
            list. It is the Panel now, with the wash it was painting itself
            (T-0033, WG-WEB-003 D). */}
        <Panel accent="orange" tint="orange" className="p-4 space-y-4">
          {loadingToolsets ? (
            <PageLoading label="Loading toolsets" rows={3} rowClassName="h-8" />
          ) : (
            <>
              <div>
                <h3 className={sectionHeadingClasses}>
                  Enabled toolsets
                </h3>
                {/* The grid below is bundles, not capabilities, and the
                    difference is the whole of D80: switching a bundle on
                    switches on everything inside it. Say which word is
                    which where the chips are. */}
                <p className="mb-2 text-body text-ps-text-muted">
                  A <ConceptHint id="toolset">toolset</ConceptHint> is a named bundle of{" "}
                  <ConceptHint id="tool">tools</ConceptHint>; turning one on turns on everything
                  in it. Hermes keeps a list per gateway; PatterStage keeps one list per profile
                  and fans it out to every gateway on save. Use <strong>Pull</strong> after{" "}
                  <code className="text-ps-text-muted">hermes tools</code> on disk.
                </p>
                {toolsetsSource && toolsetsSource !== "database" && (
                  <p className="mb-2 font-mono text-micro text-neon-orange/90">
                    Hydrated from{" "}
                    {toolsetsSource === "config_yaml" ? "config.yaml" : "seed pack"} into SQLite.
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  {HERMES_CONFIGURABLE_TOOLSETS.map((toolset) => {
                    const coveredBy = bundleCovering(unifiedEnabled, toolset.id);
                    // Covered means on: the bundle provides it. Saying so
                    // and taking the click away is the whole of D80.
                    const on = coveredBy !== null || isUnifiedEnabled(toolset.id);
                    const coveringLabel = coveredBy
                      ? HERMES_CONFIGURABLE_TOOLSETS.find((t) => t.id === coveredBy)?.label ?? coveredBy
                      : null;
                    return (
                      <Button
                        key={`unified-${toolset.id}`}
                        variant={on ? "primary" : "secondary"}
                        color="orange"
                        size="sm"
                        aria-pressed={on}
                        disabled={coveredBy !== null || jsonDirty}
                        icon={on ? Check : undefined}
                        title={
                          coveringLabel
                            ? `Included in ${coveringLabel}. Turn that bundle off to choose this one on its own.`
                            : toolset.description
                        }
                        onClick={() => toggleUnifiedToolset(toolset.id)}
                      >
                        {toolset.label}
                      </Button>
                    );
                  })}
                </div>
                {coveredLabels.length > 0 && (
                  <p className="mt-2 text-body text-ps-text-muted">
                    {coveredLabels.join(", ")} {coveredLabels.length === 1 ? "is" : "are"} included
                    in Hermes CLI. Turn that bundle off to choose them on their own.
                  </p>
                )}
                {jsonDirty && (
                  <p className="mt-2 text-body text-semantic-warning">
                    Advanced JSON is the source of truth until you save or discard it.
                  </p>
                )}
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-ps-edge-hairline pt-3">
                <Button
                  variant="ghost"
                  size="sm"
                  color="orange"
                  icon={syncing === "pull" ? undefined : Download}
                  onClick={() => void pullFromHermes("pull")}
                  disabled={syncing !== null}
                >
                  {syncing === "pull" ? "Pulling…" : "Pull from Hermes"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  color="orange"
                  icon={syncing === "push" ? undefined : Upload}
                  onClick={() => void pullFromHermes("push")}
                  disabled={syncing !== null}
                >
                  {syncing === "push" ? "Pushing…" : "Push to Hermes"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  color="orange"
                  aria-expanded={showAdvancedJson}
                  onClick={() => setShowAdvancedJson((v) => !v)}
                >
                  {showAdvancedJson ? "Hide" : "Show"} advanced JSON
                </Button>
                {jsonDirty && (
                  <Button variant="ghost" size="sm" color="orange" onClick={discardJsonEdits}>
                    Discard JSON edits
                  </Button>
                )}
              </div>
              {showAdvancedJson && (
                <Textarea
                  aria-label="Advanced toolsets JSON"
                  value={toolsetsJson}
                  onChange={(event) => {
                    setToolsetsJson(event.target.value);
                    setJsonDirty(true);
                  }}
                  className="mt-2 min-h-32 bg-ps-surface-inset text-micro"
                  spellCheck={false}
                />
              )}
            </>
          )}
        </Panel>

        <Panel className="mt-6 p-4">
          <h3 className={sectionHeadingClasses}>
            Reference — Hermes toolset IDs
          </h3>
          <p className="mb-3 text-body text-ps-text-muted">
            Catalog for labels only. Enabling toolsets above updates the selected profile config.
          </p>
          {/* The catalogue is read here, in src/app/, because ADR-0005 forbids
              core importing a module and the table lives in src/components/. */}
          <ToolsetReferenceTable entries={HERMES_CONFIGURABLE_TOOLSETS} />
        </Panel>
      </div>
    </AppPageShell>
  );
}
