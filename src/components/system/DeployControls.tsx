// ═══════════════════════════════════════════════════════════════
// DeployControls — Check for updates, Rebuild, Restart (Settings > System)
// ═══════════════════════════════════════════════════════════════
//
// This was the rail's expanded deploy block (VersionFooterViews.tsx). It moved
// to Settings > System with decision 12 (T-0097) and kept its state machine:
// useVersionFooter owns every call to /api/update, and this renders what it
// returns. It still says the truth T-0095 taught it: a deploy API that is off
// disables the three actions and says so; a version check that failed is
// painted as a warning, never as "Up to date"; the deploy log tail is shown
// after a failure. The branch to compare against sits behind Advanced.

"use client";

import { RefreshCw, AlertTriangle, Check, Hammer, Power } from "lucide-react";

import type { VersionFooterState } from "@/hooks/useVersionFooter";
import { BranchDropdown } from "@/components/layout/BranchDropdown";

const DEPLOY_OFF_TITLE = "Deploy API is off (PS_ENABLE_DEPLOY_API=false in .env.local)";

export function DeployControls({ state }: { state: VersionFooterState }) {
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
          type="button"
          onClick={() => openCheckDropdown()}
          disabled={locked}
          title={offline ? DEPLOY_OFF_TITLE : undefined}
          className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs font-mono text-blue-400 hover:bg-blue-500/20 transition-colors disabled:opacity-50"
        >
          <RefreshCw className="w-3.5 h-3.5 flex-shrink-0" />
          Check for updates
        </button>
      );
    }
    if (checkState === "checking") {
      return (
        <button type="button" disabled className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs font-mono text-blue-400 opacity-70">
          <RefreshCw className="w-3.5 h-3.5 flex-shrink-0 animate-spin" />
          Checking...
        </button>
      );
    }
    if (checkState === "check-failed") {
      // Not green. "unknown" against "unknown" is not "up to date" (D107).
      return (
        <button
          type="button"
          onClick={() => openCheckDropdown()}
          disabled={locked}
          className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-semantic-warning/10 border border-semantic-warning/20 text-xs font-mono text-semantic-warning hover:bg-semantic-warning/20 transition-colors disabled:opacity-50"
        >
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
          Could not check. Try again
        </button>
      );
    }
    if (checkState === "up-to-date") {
      return (
        <button type="button" disabled className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/20 text-xs font-mono text-green-400 cursor-default">
          <Check className="w-3.5 h-3.5 flex-shrink-0" />
          Up to date
        </button>
      );
    }
    return (
      <button
        type="button"
        onClick={handleUpdate}
        disabled={locked}
        title={offline ? DEPLOY_OFF_TITLE : undefined}
        className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-orange-500/10 border border-orange-500/20 text-xs font-mono text-neon-orange hover:bg-orange-500/20 transition-colors disabled:opacity-50"
      >
        <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
        Update available. Install it
      </button>
    );
  };

  return (
    <div className="space-y-3">
      {/* The deploy API is off: say so before the click, not 403 after it (D53) */}
      {offline && (
        <p className="text-xs font-mono text-semantic-warning">
          Deploy API is off (PS_ENABLE_DEPLOY_API=false in .env.local). Turn it on and restart to update from here.
        </p>
      )}
      {message && <p className="text-xs font-mono text-ps-text-muted">{message}</p>}
      {/* The deploy log's last lines after a failure (D108) */}
      {deployLogTail.length > 0 && (
        <pre className="max-h-40 overflow-auto rounded-lg bg-ps-surface-well px-3 py-2 text-xs font-mono text-ps-text-muted whitespace-pre-wrap break-words">
          {deployLogTail.join("\n")}
        </pre>
      )}
      {version && !version.checkFailed && (
        <p className="text-xs font-mono text-ps-text-muted">
          {version.updateAvailable
            ? `${version.behind} commit${version.behind === 1 ? "" : "s"} behind origin/${version.comparedBranch ?? version.branch}`
            : `Matches origin/${version.comparedBranch ?? version.branch}`}
          {version.commitMessage ? ` · ${version.commitMessage}` : ""}
        </p>
      )}

      <div className="relative">
        {dropdownOpen && (
          <div className="absolute top-full left-0 mt-1.5 w-64 z-50">
            <BranchDropdown
              branches={branches}
              defaultBranch={selectedBranch}
              onConfirm={handleDropdownConfirm}
              onCancel={closeDropdown}
              loading={checkState === "checking" || rebuilding}
            />
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          {renderCheckButton()}
          <button
            type="button"
            title={offline ? DEPLOY_OFF_TITLE : isArmedFor("rebuild") ? "Click again to confirm: rebuilds and restarts the app" : "npm run build, then restart, on the current checkout"}
            onClick={onRebuildClick}
            disabled={locked}
            className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-mono transition-colors disabled:opacity-50 ${
              rebuilding || isArmedFor("rebuild")
                ? "bg-neon-purple/20 border border-neon-purple/30 text-neon-purple"
                : "bg-neon-purple/10 border border-neon-purple/20 text-neon-purple hover:bg-neon-purple/20"
            }`}
          >
            <Hammer className={`w-3.5 h-3.5 flex-shrink-0 ${rebuilding ? "animate-spin" : ""}`} />
            {isArmedFor("rebuild") ? "Rebuild. Confirm?" : "Rebuild"}
          </button>
          <button
            type="button"
            title={offline ? DEPLOY_OFF_TITLE : isArmedFor("restart") ? "Click again to confirm: restarts the server" : "Restart the server only (no build)"}
            onClick={onRestartClick}
            disabled={locked}
            className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-mono transition-colors disabled:opacity-50 ${
              restarting || isArmedFor("restart")
                ? "bg-red-500/20 border border-red-500/30 text-red-300"
                : "bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20"
            }`}
          >
            <Power className={`w-3.5 h-3.5 flex-shrink-0 ${restarting ? "animate-spin" : ""}`} />
            {isArmedFor("restart") ? "Restart. Confirm?" : "Restart"}
          </button>
        </div>
      </div>

      <details className="text-xs text-ps-text-muted">
        <summary className="cursor-pointer font-mono text-ps-text-faint hover:text-ps-text-muted">Advanced</summary>
        <div className="mt-2 space-y-1 font-mono">
          <p>
            Checking asks which branch of origin to compare against; the default is the branch this install
            tracks (PS_UPDATE_GIT_BRANCH, dev unless set). Installing an update pulls that branch, builds and restarts.
          </p>
          {version?.checkoutBranch && <p>This checkout: {version.checkoutBranch}</p>}
        </div>
      </details>
    </div>
  );
}
