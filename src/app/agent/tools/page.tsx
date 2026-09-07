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
import { useState, useEffect, useCallback, useRef } from "react";
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
import ProfilePicker from "@/components/ui/ProfilePicker";
import { Textarea } from "@/components/ui/field";
import { LastResult, useToast } from "@/components/ui/Toast";
import { API_FETCH_BULK_TIMEOUT_MS, apiFetch, toastError } from "@/lib/api-fetch";
import { runSyncAction } from "@/lib/operation-sync-action";
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

export default function ToolsPage() {
  // Shared with Agents and Skills. Three pickers in three useStates meant three
  // subjects for one word (T-0113).
  const [selectedProfile, setSelectedProfile] = useSelectedProfile();
  const { data: profiles, refetch: refetchProfiles } = useProfiles();
  const profileName = profiles?.find((p) => p.id === selectedProfile)?.name ?? selectedProfile;
  const [toolsetsJson, setToolsetsJson] = useState("{}");
  const [toolsetsSource, setToolsetsSource] = useState<string | null>(null);
  const [loadingToolsets, setLoadingToolsets] = useState(true);
  const [savingToolsets, setSavingToolsets] = useState(false);
  const [syncing, setSyncing] = useState<"pull" | "push" | null>(null);
  const [unifiedEnabled, setUnifiedEnabled] = useState<string[]>([]);
  const [platformsDiverged, setPlatformsDiverged] = useState(false);
  const [showAdvancedJson, setShowAdvancedJson] = useState(false);
  // The JSON has been typed into. It is the payload from then until it is
  // saved or discarded: toggling a chip used to overwrite it and hiding the
  // panel used to drop it, both without a word (T-0103, D82).
  const [jsonDirty, setJsonDirty] = useState(false);
  // What the last read gave us, so "changed" is a fact rather than a guess.
  const [loadedEnabled, setLoadedEnabled] = useState<string[]>([]);
  // A profile the operator asked for while changes were unsaved (D84).
  const [pendingProfile, setPendingProfile] = useState<string | null>(null);
  // Read off the profiles the page already has, rather than a second raw
  // read of /api/agent/profiles on every mount (T-0129).
  const profileSyncStatus: AgentProfile["syncStatus"] | null =
    profiles?.find((p) => p.id === selectedProfile)?.syncStatus ?? null;
  const { showToast, toastElement, lastResult } = useToast();

  // The selected profile's syncStatus (drift | error | null), best-effort: a
  // failed read resets to null, which the page reads as nothing to say.

  const loadToolsets = useCallback(async () => {
    setLoadingToolsets(true);
    try {
      const data = await apiFetch(`/api/agent/profiles/${selectedProfile}/toolsets`);
      const loaded = (data.data?.platformToolsets ?? {}) as PlatformToolsets;
      const unified = (data.data?.unifiedEnabled as string[] | undefined) ??
        unionToolsetsFromPlatforms(loaded);
      setUnifiedEnabled(unified);
      setLoadedEnabled(unified);
      setJsonDirty(false);
      setPlatformsDiverged(Boolean(data.data?.platformsDiverged));
      setToolsetsJson(JSON.stringify(loaded, null, 2));
      setToolsetsSource(data.data?.source ?? null);
    } catch (err) {
      setToolsetsJson("{}");
      setToolsetsSource(null);
      setLoadedEnabled([]);
      setJsonDirty(false);
      toastError(showToast, err, "Failed to load toolsets");
    } finally {
      setLoadingToolsets(false);
    }
  }, [selectedProfile, showToast]);

  // Both reads, for the mount and for a pull or push that may have changed
  // the sync status of the active profile. A local save reloads only the
  // toolsets: the sync status moves only when Hermes disk is touched.
  // Through a ref, so the reload effect below depends on the toolsets loader
  // alone: a consumer that hands back a fresh refetch on every render would
  // otherwise re-run the effect on every render (T-0129).
  const refetchProfilesRef = useRef(refetchProfiles);
  refetchProfilesRef.current = refetchProfiles;
  const reloadAll = useCallback(async () => {
    await loadToolsets();
    await refetchProfilesRef.current();
  }, [loadToolsets]);

  useEffect(() => {
    void reloadAll();
  }, [reloadAll]);

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
    return runSyncAction({
      setBusy: setSavingToolsets,
      showToast,
      url: `/api/agent/profiles/${selectedProfile}/toolsets`,
      method: "PUT",
      body: { platformToolsets: payload },
      successMessage: "Toolsets saved and pushed to Hermes",
      errorMessage: "Failed to save toolsets",
      onSuccess: loadToolsets,
    });
  };

  const pullFromHermes = (mode: "pull" | "push") => {
    const setBusy = (busy: boolean) => setSyncing(busy ? mode : null);
    const successMessage = mode === "pull" ? "Pulled toolsets from Hermes" : (
      selectedProfile === "default"
        ? "Pushed profile to Hermes. Model defaults re-applied to config.yaml."
        : "Pushed profile to Hermes"
    );
    return runSyncAction({
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
          <div className="mb-4 flex items-start gap-2 rounded-ps-md border border-semantic-warning/30 bg-semantic-warning/10 p-3">
            <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-semantic-warning" aria-hidden="true" />
            <p className="text-body text-semantic-warning/90">
              Toolset policy on disk differs from PatterStage (format or values).{" "}
              <strong>Pull from Hermes</strong> imports disk into SQLite;{" "}
              <strong>Save &amp; push toolsets</strong> or <strong>Push</strong> writes canonical{" "}
              <code className="text-ps-text-muted">config.yaml</code> to{" "}
              <code className="text-ps-text-muted">~/.hermes</code>.
            </p>
          </div>
        )}
        {profileSyncStatus === "error" && (
          <div className="mb-4 rounded-ps-md border border-semantic-danger/30 bg-semantic-danger/10 p-3">
            <p className="text-body text-semantic-danger">
              Last sync failed. Check gateway logs, then retry Pull or Push.
            </p>
          </div>
        )}
        {platformsDiverged && (
          <div className="mb-4 flex items-start gap-2 rounded-ps-md border border-semantic-warning/30 bg-semantic-warning/10 p-3">
            <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-semantic-warning" aria-hidden="true" />
            <p className="text-body text-semantic-warning/90">
              Platforms have different toolsets on disk. The grid below shows the union.{" "}
              <strong>Save &amp; push</strong> applies one list to all gateways (like{" "}
              <code className="text-ps-text-muted">hermes tools</code> configure all).
            </p>
          </div>
        )}
        {pendingProfile && (
          <div className="mb-4 rounded-ps-md border border-semantic-warning/40 bg-semantic-warning/10 p-3">
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
          </div>
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
