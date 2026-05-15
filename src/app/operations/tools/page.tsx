// ═══════════════════════════════════════════════════════════════
// Tools Manager — Tool Plugin Registry
// Shows all tools from the SQLite registry (core, platform, custom, MCP).
// Enables/disables tools and registers new MCP/custom tools.
// ═══════════════════════════════════════════════════════════════

"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Wrench, Check, ChevronDown, ChevronRight,
  Info, ToggleLeft, ToggleRight, Plus,
} from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import type { ToolDefinition } from "@/lib/agent-backend/types";

const CATEGORY_LABELS: Record<string, string> = {
  core: "Core Tools",
  platform: "Platform Tools",
  custom: "Custom Tools",
  mcp: "MCP Tools",
};

const CATEGORY_COLORS: Record<string, "cyan" | "purple" | "orange" | "pink" | "green" | "gray"> = {
  core: "cyan",
  platform: "purple",
  custom: "orange",
  mcp: "pink",
};

export default function ToolsPage() {
  const [tools, setTools] = useState<ToolDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pendingToggles, setPendingToggles] = useState<Record<string, boolean>>({});
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    core: true, platform: true, custom: true, mcp: true,
  });
  const [showRegister, setShowRegister] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [registerForm, setRegisterForm] = useState({
    name: "", label: "", description: "", category: "custom",
  });
  const { showToast, toastElement } = useToast();

  const loadTools = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/tools");
      const d = await res.json();
      setTools(d.data?.tools ?? []);
      setPendingToggles({});
    } catch {
      showToast("Failed to load tools", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { loadTools(); }, [loadTools]);

  const isEnabled = (tool: ToolDefinition) => {
    if (tool.id in pendingToggles) return pendingToggles[tool.id];
    return tool.enabled;
  };

  const toggleTool = async (tool: ToolDefinition) => {
    const newEnabled = !isEnabled(tool);
    setPendingToggles((prev) => ({ ...prev, [tool.id]: newEnabled }));
  };

  const saveChanges = async () => {
    setSaving(true);
    try {
      for (const [id, enabled] of Object.entries(pendingToggles)) {
        await fetch("/api/tools", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "configure", id, enabled }),
        });
      }
      showToast("Tools updated", "success");
      setPendingToggles({});
      loadTools();
    } catch {
      showToast("Failed to save changes", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleRegister = async () => {
    if (!registerForm.name.trim() || !registerForm.label.trim()) return;
    setRegistering(true);
    try {
      const res = await fetch("/api/tools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "register",
          name: registerForm.name.trim(),
          label: registerForm.label.trim(),
          description: registerForm.description.trim(),
          category: registerForm.category,
        }),
      });
      if (!res.ok) throw new Error("Registration failed");
      showToast(`Tool "${registerForm.label}" registered`, "success");
      setShowRegister(false);
      setRegisterForm({ name: "", label: "", description: "", category: "custom" });
      loadTools();
    } catch {
      showToast("Failed to register tool", "error");
    } finally {
      setRegistering(false);
    }
  };

  // Group tools by category
  const toolsByCategory: Record<string, ToolDefinition[]> = {};
  for (const tool of tools) {
    const cat = tool.category || "custom";
    if (!toolsByCategory[cat]) toolsByCategory[cat] = [];
    toolsByCategory[cat].push(tool);
  }

  const hasPending = Object.keys(pendingToggles).length > 0;

  return (
    <div className="min-h-screen bg-dark-950 grid-bg">
      {toastElement}
      <PageHeader
        icon={Wrench}
        title="Tool Registry"
        subtitle={`${tools.length} tools registered — ${tools.filter(t => t.enabled).length} enabled`}
        color="orange"
        actions={
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              color="orange"
              icon={Plus}
              onClick={() => setShowRegister(true)}
            >
              Register Tool
            </Button>
            {hasPending && (
              <Button
                variant="primary"
                color="orange"
                size="sm"
                icon={saving ? undefined : Check}
                onClick={saveChanges}
                disabled={saving}
              >
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            )}
          </div>
        }
      />

      <div className="px-6 py-6">
        {loading ? (
          <LoadingSpinner text="Loading tools..." />
        ) : tools.length === 0 ? (
          <div className="text-center py-16 text-white/30">
            <Wrench className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p className="text-lg font-medium">No tools registered</p>
            <p className="text-sm mt-1">Register custom tools or enable Hermes platform tools</p>
          </div>
        ) : (
          <div className="space-y-4">
            {["core", "platform", "custom", "mcp"].map((category) => {
              const categoryTools = toolsByCategory[category] ?? [];
              if (categoryTools.length === 0) return null;
              const isExpanded = expandedCategories[category] ?? true;
              const enabledCount = categoryTools.filter(t => isEnabled(t)).length;
              const color = CATEGORY_COLORS[category] ?? "gray";

              return (
                <div key={category} className="rounded-xl border border-white/10 bg-dark-900/50">
                  {/* Category Header */}
                  <button
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 rounded-t-xl transition-colors"
                    onClick={() =>
                      setExpandedCategories((prev) => ({ ...prev, [category]: !isExpanded }))
                    }
                  >
                    <div className="flex items-center gap-2">
                      {isExpanded
                        ? <ChevronDown className="w-4 h-4 text-white/30" />
                        : <ChevronRight className="w-4 h-4 text-white/30" />}
                      <span className="text-sm font-semibold text-white/70">
                        {CATEGORY_LABELS[category] || category}
                      </span>
                      <Badge color={color} size="sm">
                        {enabledCount}/{categoryTools.length}
                      </Badge>
                    </div>
                  </button>

                  {/* Tools List */}
                  {isExpanded && (
                    <div className="border-t border-white/5">
                      {categoryTools.map((tool) => {
                        const enabled = isEnabled(tool);
                        return (
                          <div
                            key={tool.id}
                            className={`flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 transition-colors ${!enabled ? "opacity-50" : ""}`}
                          >
                            {/* Toggle */}
                            <button
                              onClick={() => toggleTool(tool)}
                              className="flex-shrink-0"
                              title={enabled ? "Disable" : "Enable"}
                            >
                              {enabled
                                ? <ToggleRight className="w-6 h-6 text-neon-orange" />
                                : <ToggleLeft className="w-6 h-6 text-white/20" />}
                            </button>

                            {/* Tool Info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-mono text-white/80">{tool.label}</span>
                                {tool.category === "mcp" && (
                                  <Badge color="pink" size="sm">MCP</Badge>
                                )}
                                {tool.category === "platform" && (
                                  <Badge color="purple" size="sm">Platform</Badge>
                                )}
                                {tool.category === "core" && (
                                  <Badge color="cyan" size="sm">Core</Badge>
                                )}
                              </div>
                              <p className="text-xs text-white/30 mt-0.5">{tool.description}</p>
                              <p className="text-xs text-white/15 mt-0.5 font-mono">{tool.name}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Info Banner */}
        <div className="mt-6 p-3 rounded-lg bg-dark-900/50 border border-white/5 flex items-start gap-2">
          <Info className="w-4 h-4 text-white/30 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-white/30">
            Tools are registered in the Control Hub SQLite database.
            Enable or disable tools to control what this agent can do.
            Hermes platform tools appear here once registered.
            MCP tools can be registered for custom integrations.
          </p>
        </div>
      </div>

      {/* Register Tool Modal */}
      <Modal
        open={showRegister}
        onClose={() => setShowRegister(false)}
        title="Register Tool"
        icon={Plus}
        iconColor="text-neon-orange"
        size="md"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setShowRegister(false)}>Cancel</Button>
            <Button
              variant="primary"
              color="orange"
              size="sm"
              icon={Plus}
              onClick={handleRegister}
              disabled={!registerForm.name.trim() || !registerForm.label.trim() || registering}
            >
              {registering ? "Registering..." : "Register"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-white/50 mb-1">Tool Name (unique identifier)</label>
            <input
              type="text"
              value={registerForm.name}
              onChange={(e) => setRegisterForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. my-custom-tool"
              className="w-full bg-dark-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-orange-500/50 focus:outline-none font-mono"
            />
          </div>
          <div>
            <label className="block text-sm text-white/50 mb-1">Display Label</label>
            <input
              type="text"
              value={registerForm.label}
              onChange={(e) => setRegisterForm(f => ({ ...f, label: e.target.value }))}
              placeholder="e.g. My Custom Tool"
              className="w-full bg-dark-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-orange-500/50 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm text-white/50 mb-1">Description</label>
            <textarea
              value={registerForm.description}
              onChange={(e) => setRegisterForm(f => ({ ...f, description: e.target.value }))}
              placeholder="What does this tool do?"
              rows={3}
              className="w-full bg-dark-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-orange-500/50 focus:outline-none resize-none"
            />
          </div>
          <div>
            <label className="block text-sm text-white/50 mb-1">Category</label>
            <select
              value={registerForm.category}
              onChange={(e) => setRegisterForm(f => ({ ...f, category: e.target.value }))}
              className="w-full bg-dark-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-orange-500/50 focus:outline-none"
            >
              <option value="core">Core</option>
              <option value="platform">Platform</option>
              <option value="custom">Custom</option>
              <option value="mcp">MCP</option>
            </select>
          </div>
        </div>
      </Modal>
    </div>
  );
}
