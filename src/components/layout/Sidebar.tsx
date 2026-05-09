// ═══════════════════════════════════════════════════════════════

// Sidebar Navigation — Config Settings with categorized groups

// ═══════════════════════════════════════════════════════════════

"use client";

import { useState, useEffect, useCallback, useRef } from "react";

import Link from "next/link";

import { usePathname } from "next/navigation";

import { useSidebar } from "./SidebarContext";

import {
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  X,
  Terminal,
  Settings,
  RefreshCw,
  AlertTriangle,
  Check,
  Hammer,
  Power,
} from "lucide-react";

import { iconColorMap } from "@/lib/theme";
import {
  mainSections,
  configGroups,
} from "./sidebar-config";

import type { SidebarLink, ConfigGroup } from "./sidebar-config";

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";

  return pathname.startsWith(href);
}

// ── Branch Modal ───────────────────────────────────────────────

interface BranchModalProps {
  open: boolean;
  branches: string[];
  defaultBranch: string;
  onConfirm: (branch: string) => void;
  onCancel: () => void;
  loading?: boolean;
}

function BranchModal({
  open,
  branches,
  defaultBranch,
  onConfirm,
  onCancel,
  loading,
}: BranchModalProps) {
  const [selected, setSelected] = useState(defaultBranch);

  useEffect(() => {
    if (open) setSelected(defaultBranch);
  }, [open, defaultBranch]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-sm mx-4 rounded-xl border border-white/10 bg-dark-950 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <h2 className="text-base font-bold text-white">Select Branch</h2>
          <button
            onClick={onCancel}
            className="p-1 rounded-lg text-white/40 hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5">
          <label className="block text-xs font-mono text-white/40 uppercase tracking-wider mb-2">
            Branch
          </label>
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-dark-900 border border-white/10 text-white text-sm focus:outline-none focus:border-neon-cyan/50 focus:ring-1 focus:ring-neon-cyan/20"
          >
            {branches.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-white/10">
          <button
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 rounded-lg text-sm text-white/60 hover:bg-white/5 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(selected)}
            disabled={loading || !selected}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-neon-cyan text-dark-900 hover:brightness-110 transition disabled:opacity-50"
          >
            {loading ? "..." : "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Version Check & Update ─────────────────────────────────────

interface VersionInfo {
  localHash: string;
  remoteHash: string;
  updateAvailable: boolean;
  commitMessage: string;
  behind: number;
  branch: string;
  lastChecked: string;
}

function VersionFooter({ collapsed }: { collapsed: boolean }) {
  const [version, setVersion] = useState<VersionInfo | null>(null);
  const [checkState, setCheckState] = useState<
    "idle" | "checking" | "up-to-date" | "update-available"
  >("idle");
  const [updating, setUpdating] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [rebuilding, setRebuilding] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Branch modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalPurpose, setModalPurpose] = useState<"check" | "rebuild">("check");
  const [branches, setBranches] = useState<string[]>([]);
  const [selectedBranch, setSelectedBranch] = useState("main");

  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (pollIntervalRef.current !== null) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, []);

  // Fetch branch list and open modal
  const openBranchModal = async (purpose: "check" | "rebuild") => {
    setModalPurpose(purpose);
    try {
      const res = await fetch("/api/update?branches=1");
      const d = await res.json();
      if (d.data?.branches) {
        setBranches(d.data.branches);
        setSelectedBranch(d.data.default || "main");
      } else {
        setBranches(["main", "dev"]);
        setSelectedBranch("main");
      }
    } catch {
      setBranches(["main", "dev"]);
      setSelectedBranch("main");
    }
    setModalOpen(true);
  };

  const handleModalConfirm = async (branch: string) => {
    setModalOpen(false);
    if (modalPurpose === "check") {
      await doCheck(branch);
    } else {
      await doRebuild(branch);
    }
  };

  // Check version against a specific branch
  const doCheck = async (branch: string) => {
    setCheckState("checking");
    setMessage(null);
    try {
      const res = await fetch(`/api/update?branch=${encodeURIComponent(branch)}`);
      const d = await res.json();
      if (d.data) {
        setVersion(d.data);
        setCheckState(d.data.updateAvailable ? "update-available" : "up-to-date");
      } else {
        setCheckState("idle");
        setMessage("Check failed");
      }
    } catch {
      setCheckState("idle");
      setMessage("Check failed");
    }
  };

  const handleUpdate = async () => {
    if (updating || !version?.updateAvailable) return;
    setUpdating(true);
    setMessage("Updating...");
    try {
      const res = await fetch("/api/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update" }),
      });
      const d = await res.json();
      if (d.error) {
        setMessage(d.error);
        setUpdating(false);
        return;
      }
      setMessage("Restarting...");
      pollForReturn();
    } catch {
      setMessage("Update failed");
      setUpdating(false);
    }
  };

  const handleRestart = async () => {
    if (restarting) return;
    setRestarting(true);
    setMessage("Restarting...");
    try {
      const res = await fetch("/api/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "restart" }),
      });
      if (!res.ok) {
        let msg = "Restart failed";
        try {
          const body = await res.json();
          if (body?.error) msg = body.error;
        } catch { /* ignore */ }
        throw new Error(msg);
      }
      pollForReturn();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Restart failed";
      setMessage(msg);
      setRestarting(false);
    }
  };

  const doRebuild = async (branch: string) => {
    if (rebuilding) return;
    setRebuilding(true);
    setMessage("Rebuilding...");
    try {
      const res = await fetch("/api/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "rebuild", branch }),
      });
      if (!res.ok) {
        let msg = "Rebuild failed";
        try {
          const body = await res.json();
          if (body?.error) msg = body.error;
        } catch { /* ignore */ }
        throw new Error(msg);
      }
      setMessage("Build complete — restarting...");
      pollForReturn();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Rebuild failed";
      setMessage(msg);
      setRebuilding(false);
    }
  };

  const pollForReturn = () => {
    if (pollIntervalRef.current !== null) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    let attempts = 0;
    const maxAttempts = 30;
    const interval = setInterval(async () => {
      attempts++;
      try {
        const res = await fetch("/api/update", {
          signal: AbortSignal.timeout(3000),
        });
        if (res.ok) {
          clearInterval(interval);
          pollIntervalRef.current = null;
          const d = await res.json();
          if (!isMountedRef.current) return;
          if (d.data) setVersion(d.data);
          setUpdating(false);
          setRestarting(false);
          setRebuilding(false);
          setCheckState(d.data?.updateAvailable ? "update-available" : "up-to-date");
          setMessage("Done!");
          setTimeout(() => {
            if (isMountedRef.current) setMessage(null);
          }, 3000);
        }
      } catch {
        if (attempts >= maxAttempts) {
          clearInterval(interval);
          pollIntervalRef.current = null;
          if (!isMountedRef.current) return;
          setUpdating(false);
          setRestarting(false);
          setRebuilding(false);
          setMessage("Timeout — check server");
        }
      }
    }, 2000);
    pollIntervalRef.current = interval;
  };

  const isBusy = updating || restarting || rebuilding;

  // ── Collapsed view ───────────────────────────────────────────
  if (collapsed) {
    return (
      <>
        <div className="flex flex-col items-center gap-2">
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
              onClick={() => openBranchModal("check")}
              disabled={checkState === "checking" || isBusy}
              className="p-1.5 rounded-lg text-white/30 hover:text-white/60 hover:bg-white/5 transition-colors"
              title={checkState === "checking" ? "Checking..." : "Check for Update"}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${checkState === "checking" ? "animate-spin" : ""}`} />
            </button>
          )}

          {/* Rebuild — opens branch modal */}
          <button
            onClick={() => openBranchModal("rebuild")}
            disabled={isBusy}
            className="p-1.5 rounded-lg text-white/30 hover:text-white/60 hover:bg-white/5 transition-colors"
            title={message || "Rebuild App"}
          >
            <Hammer className={`w-3.5 h-3.5 ${rebuilding ? "animate-spin" : ""}`} />
          </button>

          {/* Restart */}
          <button
            onClick={handleRestart}
            disabled={isBusy}
            className="p-1.5 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            title={message || "Restart App"}
          >
            <Power className={`w-3.5 h-3.5 ${restarting ? "animate-spin" : ""}`} />
          </button>
        </div>

        <BranchModal
          open={modalOpen}
          branches={branches}
          defaultBranch={selectedBranch}
          onConfirm={handleModalConfirm}
          onCancel={() => setModalOpen(false)}
          loading={checkState === "checking" || rebuilding}
        />
      </>
    );
  }

  // ── Expanded view ────────────────────────────────────────────
  const checkButton = () => {
    if (checkState === "idle") {
      return (
        <button
          onClick={() => openBranchModal("check")}
          disabled={isBusy}
          className="flex-1 flex items-center justify-center gap-1 px-1.5 py-1 rounded-md bg-blue-500/10 border border-blue-500/20 text-[9px] font-mono text-blue-400 hover:bg-blue-500/20 transition-colors disabled:opacity-50"
        >
          <RefreshCw className="w-2.5 h-2.5 flex-shrink-0" />
          Check
        </button>
      );
    }
    if (checkState === "checking") {
      return (
        <button disabled className="flex-1 flex items-center justify-center gap-1 px-1.5 py-1 rounded-md bg-blue-500/10 border border-blue-500/20 text-[9px] font-mono text-blue-400 opacity-70">
          <RefreshCw className="w-2.5 h-2.5 flex-shrink-0 animate-spin" />
          ...
        </button>
      );
    }
    if (checkState === "up-to-date") {
      return (
        <button
          disabled
          className="flex-1 flex items-center justify-center gap-1 px-1.5 py-1 rounded-md bg-green-500/10 border border-green-500/20 text-[9px] font-mono text-green-400 cursor-default"
        >
          <Check className="w-2.5 h-2.5 flex-shrink-0" />
          Up to Date
        </button>
      );
    }
    // update-available
    return (
      <button
        onClick={handleUpdate}
        disabled={isBusy}
        className="flex-1 flex items-center justify-center gap-1 px-1.5 py-1 rounded-md bg-orange-500/10 border border-orange-500/20 text-[9px] font-mono text-neon-orange hover:bg-orange-500/20 transition-colors disabled:opacity-50"
      >
        <AlertTriangle className="w-2.5 h-2.5 flex-shrink-0" />
        Update Available!
      </button>
    );
  };

  return (
    <>
      <div className="flex gap-1.5">
        {checkButton()}

        <button
          onClick={() => openBranchModal("rebuild")}
          disabled={isBusy}
          className="flex-1 flex items-center justify-center gap-1 px-1.5 py-1 rounded-md bg-purple-500/10 border border-purple-500/20 text-[9px] font-mono text-purple-400 hover:bg-purple-500/20 transition-colors disabled:opacity-50"
        >
          <Hammer className={`w-2.5 h-2.5 flex-shrink-0 ${rebuilding ? "animate-spin" : ""}`} />
          {rebuilding ? "..." : "Rebuild"}
        </button>

        <button
          onClick={handleRestart}
          disabled={isBusy}
          className="flex-1 flex items-center justify-center gap-1 px-1.5 py-1 rounded-md bg-red-500/10 border border-red-500/20 text-[9px] font-mono text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50"
        >
          <Power className={`w-2.5 h-2.5 flex-shrink-0 ${restarting ? "animate-spin" : ""}`} />
          {restarting ? "..." : "Restart"}
        </button>
      </div>

      <BranchModal
        open={modalOpen}
        branches={branches}
        defaultBranch={selectedBranch}
        onConfirm={handleModalConfirm}
        onCancel={() => setModalOpen(false)}
        loading={checkState === "checking" || rebuilding}
      />
    </>
  );
}

function ConfigGroupSection({
  group,

  collapsed,

  renderLink,

  pathname,
}: {
  group: ConfigGroup;

  collapsed: boolean;

  renderLink: (link: SidebarLink) => React.ReactNode;

  pathname: string;
}) {
  const [open, setOpen] = useState(() => {
    // Lazy init: auto-expand if any link in this group is active
    return (
      group.defaultOpen ??
      group.links.some(
        (link) =>
          pathname === link.href ||
          (link.href !== "/" && pathname.startsWith(link.href)),
      )
    );
  });

  if (collapsed) {
    return <>{group.links.map((link) => renderLink(link))}</>;
  }

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 w-full text-[10px] font-mono text-white/30 uppercase tracking-widest px-3 mb-1 mt-3 first:mt-0 hover:text-white/50 transition-colors"
      >
        <ChevronDown
          className={`w-3 h-3 transition-transform ${open ? "" : "-rotate-90"}`}
        />

        {group.label}
      </button>

      {open && (
        <div className="space-y-0.5">
          {group.links.map((link) => renderLink(link))}
        </div>
      )}
    </div>
  );
}

export default function Sidebar() {
  const pathname = usePathname();

  const [collapsed, setCollapsed] = useState(false);

  const { mobileOpen, setMobileOpen } = useSidebar();

  const closeMobile = useCallback(() => setMobileOpen(false), [setMobileOpen]);

  const renderLink = useCallback(
    (link: SidebarLink) => {
      const active = isActive(pathname, link.href);
      const showSubs = active && link.subLinks && !collapsed;

      return (
        <div key={link.href}>
          <Link
            href={link.href}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
              active
                ? "bg-white/10 text-white"
                : "text-white/50 hover:bg-white/5 hover:text-white/80"
            }`}
            onClick={closeMobile}
          >
            <link.icon
              className={`w-4 h-4 flex-shrink-0 ${
                active ? iconColorMap[link.color] : ""
              }`}
            />
            {!collapsed && <span>{link.label}</span>}
          </Link>
          {showSubs && (
            <div className="ml-7 mt-1 space-y-0.5 border-l border-white/5 pl-3">
              {link.subLinks!.map((sub) => (
                <Link
                  key={sub.href}
                  href={sub.href}
                  className={`block py-1 text-xs transition-colors ${
                    pathname === sub.href
                      ? "text-white/80"
                      : "text-white/30 hover:text-white/60"
                  }`}
                  onClick={closeMobile}
                >
                  {sub.label}
                </Link>
              ))}
            </div>
          )}
        </div>
      );
    },
    [pathname, collapsed, closeMobile],
  );

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo — h-12 to match mobile top bar */}

      <div className="px-4 h-12 flex items-center border-b border-white/10">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg animated-border p-[1.5px]">
            <div className="w-full h-full bg-dark-900 rounded-[5px] flex items-center justify-center">
              <Terminal className="w-4 h-4 text-neon-cyan" />
            </div>
          </div>

          {!collapsed && (
            <div>
              <div className="text-sm font-bold tracking-tight">
                <span className="text-neon-cyan">CH</span>

                <span className="text-white/40 mx-0.5">/</span>

                <span className="text-white">Hermes</span>
              </div>
            </div>
          )}
        </Link>
      </div>

      {/* Main Nav */}

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {/* Main + Agent sections */}

        {mainSections.map((section) => (
          <div key={section.label}>
            {!collapsed && (
              <div className="text-[10px] font-mono text-white/30 uppercase tracking-widest px-3 mb-2 mt-4 first:mt-0">
                {section.label}
              </div>
            )}

            {section.links
              .map(renderLink)}
          </div>
        ))}

        {/* Config Settings section */}

        {!collapsed && (
          <div className="text-[10px] font-mono text-white/30 uppercase tracking-widest px-3 mb-2 mt-4">
            Config Settings
          </div>
        )}

        {collapsed && <div className="my-2 border-t border-white/10" />}

        {/* All Settings link */}

        {renderLink({
          icon: Settings,

          label: "All Settings",

          href: "/config",

          color: "purple",
        })}

        {/* Grouped config sections */}

        {configGroups.map((group) => (
          <ConfigGroupSection
            key={group.label}
            group={group}
            collapsed={collapsed}
            renderLink={renderLink}
            pathname={pathname}
          />
        ))}
      </nav>

      {/* Footer */}

      <div className="px-3 py-3 border-t border-white/10 space-y-2 flex-shrink-0 overflow-hidden">
        <VersionFooter collapsed={collapsed} />

        <button
          onClick={() => setCollapsed(!collapsed)}
          className="hidden lg:flex items-center gap-2 w-full px-3 py-2 rounded-lg text-xs text-white/30 hover:text-white/60 hover:bg-white/5 transition-colors font-mono"
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <>
              <ChevronLeft className="w-4 h-4" />

              <span>Collapse</span>
            </>
          )}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile overlay */}

      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/60 z-40"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar — desktop */}

      <aside
        className={`hidden lg:flex flex-col bg-dark-900/80 border-r border-white/10 backdrop-blur-xl transition-all duration-200 ${
          collapsed ? "w-16" : "w-56"
        }`}
      >
        {sidebarContent}
      </aside>

      {/* Sidebar — mobile drawer */}

      <aside
        className={`lg:hidden fixed inset-y-0 left-0 z-50 w-56 bg-dark-950 border-r border-white/10 transform transition-transform ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {sidebarContent}
      </aside>
    </>
  );
}
