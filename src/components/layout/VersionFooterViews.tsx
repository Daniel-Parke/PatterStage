// ═══════════════════════════════════════════════════════════════
// VersionFooterViews - the two render modes of the deploy block
// ═══════════════════════════════════════════════════════════════
//
// Extracted from VersionFooter.tsx. The sidebar renders one of these
// depending on whether it is collapsed: icon buttons in a column, or the
// full-width Check button over a Rebuild/Restart pair. Both take the
// whole `useVersionFooter` result and render it; neither fetches, polls
// or owns state.

"use client";

import { RefreshCw, AlertTriangle, Check, Hammer, Power } from "lucide-react";

import type { VersionFooterState } from "@/hooks/useVersionFooter";

import { BranchDropdown } from "./BranchDropdown";

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
    openCheckDropdown,
    closeDropdown,
    handleDropdownConfirm,
    handleUpdate,
    onRebuildClick,
    onRestartClick,
    isArmedFor,
  } = state;

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

        {/* Check transforms to orange alert when update available */}
        {checkState === "update-available" ? (
          <button
            onClick={handleUpdate}
            disabled={isBusy}
            className="p-1.5 rounded-lg bg-orange-500/10 text-neon-orange hover:bg-orange-500/20 transition-colors"
            title={`Update available — ${version?.behind} behind`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
          </button>
        ) : (
          <button
            onClick={() => openCheckDropdown()}
            disabled={checkState === "checking" || isBusy}
            className="p-1.5 rounded-lg text-white/30 hover:text-white/60 hover:bg-white/5 transition-colors"
            title={checkState === "checking" ? "Checking..." : "Check for Update"}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${checkState === "checking" ? "animate-spin" : ""}`} />
          </button>
        )}

        {/* Rebuild (two-step confirm) */}
        <button
          onClick={onRebuildClick}
          disabled={isBusy}
          className={`p-1.5 rounded-lg transition-colors ${isArmedFor("rebuild") ? "text-neon-orange bg-orange-500/10" : "text-white/30 hover:text-white/60 hover:bg-white/5"}`}
          title={isArmedFor("rebuild") ? "Click again to confirm rebuild" : (message || "Rebuild App")}
        >
          <Hammer className={`w-3.5 h-3.5 flex-shrink-0 ${rebuilding ? "animate-spin" : ""}`} />
        </button>

        {/* Restart (two-step confirm) */}
        <button
          onClick={onRestartClick}
          disabled={isBusy}
          className={`p-1.5 rounded-lg transition-colors ${isArmedFor("restart") ? "text-red-400 bg-red-500/10" : "text-white/30 hover:text-red-400 hover:bg-red-500/10"}`}
          title={isArmedFor("restart") ? "Click again to confirm restart" : (message || "Restart App")}
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
    openCheckDropdown,
    closeDropdown,
    handleDropdownConfirm,
    handleUpdate,
    onRebuildClick,
    onRestartClick,
    isArmedFor,
  } = state;

  const renderCheckButton = () => {
    if (checkState === "idle") {
      return (
        <button
          onClick={() => openCheckDropdown()}
          disabled={isBusy}
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
        disabled={isBusy}
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
        {/* Status message — visible inline when operation is in progress */}
        {message && (
          <div className="min-h-[1.25rem] px-1 text-[10px] font-mono text-white/50 text-center leading-tight">
            {message}
          </div>
        )}
        {/* Check — full width on its own row */}
        {renderCheckButton()}

        {/* Rebuild + Restart — side by side */}
        <div className="flex gap-1.5">
          <button
            type="button"
            title={isArmedFor("rebuild") ? "Click again to confirm — rebuilds + restarts the app" : "npm run build + restart (current checkout)"}
            onClick={onRebuildClick}
            disabled={isBusy}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-mono transition-colors disabled:opacity-50 ${
              rebuilding || isArmedFor("rebuild")
                ? "bg-neon-purple/20 border border-neon-purple/30 text-neon-purple/90"
                : "bg-neon-purple/10 border border-neon-purple/20 text-neon-purple hover:bg-neon-purple/20"
            }`}
          >
            <Hammer className={`w-3.5 h-3.5 flex-shrink-0 ${rebuilding ? "animate-spin" : ""}`} />
            {isArmedFor("rebuild") ? "Confirm?" : "Rebuild"}
          </button>

          <button
            type="button"
            title={isArmedFor("restart") ? "Click again to confirm — restarts the server" : "Restart next-server only (no build)"}
            onClick={onRestartClick}
            disabled={isBusy}
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
