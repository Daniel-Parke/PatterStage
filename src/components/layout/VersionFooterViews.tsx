// ═══════════════════════════════════════════════════════════════
// VersionFooterViews - the two render modes of the deploy block
// ═══════════════════════════════════════════════════════════════
//
// Extracted from VersionFooter.tsx. The sidebar renders one of these
// depending on whether it is collapsed: icon buttons in a column, or the
// full-width Check button over a Rebuild/Restart pair. Both take the
// whole `useVersionFooter` result and render it; neither fetches, polls
// or owns state.
//
// Both say the truth the hook now carries (T-0095): a deploy API that is
// off disables the three actions and says so; a version check that failed
// is painted as a warning, never as "Up to Date"; the deploy log tail is
// shown after a failure.

"use client";

import { RefreshCw, AlertTriangle, Check, Hammer, Power } from "lucide-react";

import type { VersionFooterState } from "@/hooks/useVersionFooter";

import { BranchDropdown } from "./BranchDropdown";

const DEPLOY_OFF_TITLE = "Deploy API is off (PS_ENABLE_DEPLOY_API=false in .env.local)";

// ── Collapsed view ───────────────────────────────────────────
export function VersionFooterCollapsed({ state }: { state: VersionFooterState }) {
  const {
    version,
    checkState,
    rebuilding,
    restarting,
    isBusy,
    message,
    dropdownOpen,
    branches,
    selectedBranch,
    deployEnabled,
    openCheckDropdown,
    closeDropdown,
    handleDropdownConfirm,
    handleUpdate,
    onRebuildClick,
    onRestartClick,
    isArmedFor,
  } = state;
  const offline = deployEnabled === false;
  const locked = isBusy || offline;

  return (
    <>
      <div className="flex flex-col items-center gap-2 relative">
        {/* Branch dropdown for collapsed view */}
        {dropdownOpen && (
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 w-44 z-50">
            <BranchDropdown
              branches={branches}
              defaultBranch={selectedBranch}
              onConfirm={handleDropdownConfirm}
              onCancel={closeDropdown}
              loading={checkState === "checking" || rebuilding}
            />
          </div>
        )}

        {/* Check transforms to orange alert when update available, amber when the check failed */}
        {checkState === "update-available" ? (
          <button
            onClick={handleUpdate}
            disabled={locked}
            className="p-1.5 rounded-lg bg-orange-500/10 text-neon-orange hover:bg-orange-500/20 transition-colors"
            title={offline ? DEPLOY_OFF_TITLE : `Update available — ${version?.behind} behind`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
          </button>
        ) : checkState === "check-failed" ? (
          <button
            onClick={() => openCheckDropdown()}
            disabled={locked}
            className="p-1.5 rounded-lg bg-semantic-warning/10 text-semantic-warning hover:bg-semantic-warning/20 transition-colors"
            title={offline ? DEPLOY_OFF_TITLE : message || "Could not check. Try again"}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
          </button>
        ) : (
          <button
            onClick={() => openCheckDropdown()}
            disabled={checkState === "checking" || locked}
            className="p-1.5 rounded-lg text-ps-text-muted hover:text-ps-text-secondary hover:bg-white/5 transition-colors"
            title={offline ? DEPLOY_OFF_TITLE : checkState === "checking" ? "Checking..." : "Check for Update"}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${checkState === "checking" ? "animate-spin" : ""}`} />
          </button>
        )}

        {/* Rebuild (two-step confirm) */}
        <button
          onClick={onRebuildClick}
          disabled={locked}
          className={`p-1.5 rounded-lg transition-colors ${isArmedFor("rebuild") ? "text-neon-orange bg-orange-500/10" : "text-ps-text-muted hover:text-ps-text-secondary hover:bg-white/5"}`}
          title={offline ? DEPLOY_OFF_TITLE : isArmedFor("rebuild") ? "Click again to confirm rebuild" : (message || "Rebuild App")}
        >
          <Hammer className={`w-3.5 h-3.5 flex-shrink-0 ${rebuilding ? "animate-spin" : ""}`} />
        </button>

        {/* Restart (two-step confirm) */}
        <button
          onClick={onRestartClick}
          disabled={locked}
          className={`p-1.5 rounded-lg transition-colors ${isArmedFor("restart") ? "text-red-400 bg-red-500/10" : "text-ps-text-muted hover:text-red-400 hover:bg-red-500/10"}`}
          title={offline ? DEPLOY_OFF_TITLE : isArmedFor("restart") ? "Click again to confirm restart" : (message || "Restart App")}
        >
          <Power className={`w-3.5 h-3.5 flex-shrink-0 ${restarting ? "animate-spin" : ""}`} />
        </button>
      </div>
    </>
  );
}

// ── Expanded view ────────────────────────────────────────────
export function VersionFooterExpanded({ state }: { state: VersionFooterState }) {
  const {
    checkState,
    rebuilding,
    restarting,
    isBusy,
    message,
    dropdownOpen,
    branches,
    selectedBranch,
    deployEnabled,
    deployLogTail,
    openCheckDropdown,
    closeDropdown,
    handleDropdownConfirm,
    handleUpdate,
    onRebuildClick,
    onRestartClick,
    isArmedFor,
  } = state;
  const offline = deployEnabled === false;
  const locked = isBusy || offline;

  const renderCheckButton = () => {
    if (checkState === "idle") {
      return (
        <button
          onClick={() => openCheckDropdown()}
          disabled={locked}
          title={offline ? DEPLOY_OFF_TITLE : undefined}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs font-mono text-blue-400 hover:bg-blue-500/20 transition-colors disabled:opacity-50"
        >
          <RefreshCw className="w-3.5 h-3.5 flex-shrink-0" />
          Check for Updates
        </button>
      );
    }
    if (checkState === "checking") {
      return (
        <button disabled className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs font-mono text-blue-400 opacity-70">
          <RefreshCw className="w-3.5 h-3.5 flex-shrink-0 animate-spin" />
          Checking...
        </button>
      );
    }
    if (checkState === "check-failed") {
      // Not green. "unknown" against "unknown" is not "up to date" (D107).
      return (
        <button
          onClick={() => openCheckDropdown()}
          disabled={locked}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-semantic-warning/10 border border-semantic-warning/20 text-xs font-mono text-semantic-warning hover:bg-semantic-warning/20 transition-colors disabled:opacity-50"
        >
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
          Could not check. Try again
        </button>
      );
    }
    if (checkState === "up-to-date") {
      return (
        <button disabled className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/20 text-xs font-mono text-green-400 cursor-default">
          <Check className="w-3.5 h-3.5 flex-shrink-0" />
          Up to Date
        </button>
      );
    }
    return (
      <button
        onClick={handleUpdate}
        disabled={locked}
        title={offline ? DEPLOY_OFF_TITLE : undefined}
        className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-orange-500/10 border border-orange-500/20 text-xs font-mono text-neon-orange hover:bg-orange-500/20 transition-colors disabled:opacity-50"
      >
        <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
        Update Available!
      </button>
    );
  };

  return (
    <div className="relative">
      {/* Branch dropdown — anchored above the button row */}
      {dropdownOpen && (
        <div className="absolute bottom-full left-0 right-0 mb-1.5 z-50">
          <BranchDropdown
            branches={branches}
            defaultBranch={selectedBranch}
            onConfirm={handleDropdownConfirm}
            onCancel={closeDropdown}
            loading={checkState === "checking" || rebuilding}
          />
        </div>
      )}

      {/* Button rows — all content lives here so the status message never pushes layout */}
      <div className="space-y-1.5">
        {/* The deploy API is off: say so before the click, not 403 after it (D53) */}
        {offline && (
          <div className="min-h-[1.25rem] px-1 text-xs font-mono text-semantic-warning text-center leading-tight">
            Deploy API is off (PS_ENABLE_DEPLOY_API=false in .env.local)
          </div>
        )}
        {/* Status message — visible inline when operation is in progress */}
        {message && (
          <div className="min-h-[1.25rem] px-1 text-xs font-mono text-ps-text-muted text-center leading-tight">
            {message}
          </div>
        )}
        {/* The deploy log's last lines after a failure (D108) */}
        {deployLogTail.length > 0 && (
          <pre className="max-h-32 overflow-auto rounded-lg bg-ps-surface-well px-2 py-1.5 text-xs font-mono text-ps-text-muted whitespace-pre-wrap break-words">
            {deployLogTail.join("\n")}
          </pre>
        )}
        {/* Check — full width on its own row */}
        {renderCheckButton()}

        {/* Rebuild + Restart — side by side */}
        <div className="flex gap-1.5">
          <button
            type="button"
            title={offline ? DEPLOY_OFF_TITLE : isArmedFor("rebuild") ? "Click again to confirm — rebuilds + restarts the app" : "npm run build + restart (current checkout)"}
            onClick={onRebuildClick}
            disabled={locked}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-mono transition-colors disabled:opacity-50 ${
              rebuilding || isArmedFor("rebuild")
                ? "bg-neon-purple/20 border border-neon-purple/30 text-neon-purple"
                : "bg-neon-purple/10 border border-neon-purple/20 text-neon-purple hover:bg-neon-purple/20"
            }`}
          >
            <Hammer className={`w-3.5 h-3.5 flex-shrink-0 ${rebuilding ? "animate-spin" : ""}`} />
            {isArmedFor("rebuild") ? "Confirm?" : "Rebuild"}
          </button>

          <button
            type="button"
            title={offline ? DEPLOY_OFF_TITLE : isArmedFor("restart") ? "Click again to confirm — restarts the server" : "Restart next-server only (no build)"}
            onClick={onRestartClick}
            disabled={locked}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-mono transition-colors disabled:opacity-50 ${
              restarting || isArmedFor("restart")
                ? "bg-red-500/20 border border-red-500/30 text-red-300"
                : "bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20"
            }`}
          >
            <Power className={`w-3.5 h-3.5 flex-shrink-0 ${restarting ? "animate-spin" : ""}`} />
            {isArmedFor("restart") ? "Confirm?" : "Restart"}
          </button>
        </div>
      </div>
    </div>
  );
}
