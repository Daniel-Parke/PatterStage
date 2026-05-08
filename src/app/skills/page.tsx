// ═══════════════════════════════════════════════════════════════
// Skills Manager — Profile-aware with collapsible categories
// ═══════════════════════════════════════════════════════════════

"use client";

import { useState, useEffect, useCallback } from "react";
import {
  FileText, ChevronDown, ChevronRight, Eye, ToggleLeft, ToggleRight, Save,
} from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import { SearchInput } from "@/components/ui/Input";
import { LoadingSpinner, EmptyState } from "@/components/ui/LoadingSpinner";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";

interface Skill {
  name: string;
  category: string;
  path: string;
  description: string;
  enabled: boolean;
  size: number;
  lastModified: string;
}

interface SkillsData {
  skills: Skill[];
  categories: Record<string, Skill[]>;
  total: number;
  categoryCount: number;
  profile: string;
}

export default function SkillsPage() {
  const [data, setData] = useState<SkillsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedProfile, setSelectedProfile] = useState("default");
  const [profiles, setProfiles] = useState<Array<{ id: string; name: string }>>([]);
  const [pendingToggles, setPendingToggles] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [expandedSkill, setExpandedSkill] = useState<string | null>(null);
  const [skillContent, setSkillContent] = useState<string>("");
  const { showToast, toastElement } = useToast();

  useEffect(() => {
    fetch("/api/agent/profiles")
      .then((res) => res.json())
      .then((d) => {
        // Deduplicate profiles by id
        const seen = new Set<string>();
        const ps = (d.data?.profiles || [])
          .map((p: { id: string; name: string }) => ({ id: p.id, name: p.name }))
          .filter((p: { id: string }) => { if (seen.has(p.id)) return false; seen.add(p.id); return true; });
        setProfiles(ps);
      })
      .catch((error) => {
        console.error("Failed to load profiles:", error);
      });
  }, []);

  const loadSkills = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/skills?profile=${selectedProfile}`);
      const d = await res.json();
      setData(d.data);
      setPendingToggles({});
      // Auto-expand first 2 categories
      const cats = Object.keys(d.data?.categories || {});
      const expanded: Record<string, boolean> = {};
      cats.slice(0, 2).forEach((c) => (expanded[c] = true));
      setExpandedCategories(expanded);
    } catch {
      showToast("Failed to load skills", "error");
    } finally {
      setLoading(false);
    }
  }, [selectedProfile, showToast]);

  useEffect(() => { loadSkills(); }, [loadSkills]);

  const toggleSkill = (skillName: string, currentEnabled: boolean) => {
    setPendingToggles((prev) => ({ ...prev, [skillName]: !currentEnabled }));
  };

  const saveToggles = async () => {
    if (Object.keys(pendingToggles).length === 0) return;
    setSaving(true);
    try {
      for (const [skillName, enabled] of Object.entries(pendingToggles)) {
        await fetch(`/api/skills/${encodeURIComponent(skillName)}/toggle`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ profile: selectedProfile, enabled }),
        });
      }
      showToast(`Updated ${Object.keys(pendingToggles).length} skills`, "success");
      loadSkills();
    } catch {
      showToast("Failed to save changes", "error");
    } finally {
      setSaving(false);
    }
  };

  const viewSkill = async (skill: Skill) => {
    if (expandedSkill === skill.name) { setExpandedSkill(null); return; }
    setExpandedSkill(skill.name);
    try {
      const res = await fetch(`/api/skills/${encodeURIComponent(skill.name)}?profile=${selectedProfile}`);
      const d = await res.json();
      setSkillContent(d.data?.content || "");
    } catch {
      setSkillContent("// Failed to load");
    }
  };

  const isSkillEnabled = (skill: Skill) => {
    if (skill.name in pendingToggles) return pendingToggles[skill.name];
    return skill.enabled;
  };

  const categories = data?.categories || {};
  const enabledCount = data?.skills.filter((s) => isSkillEnabled(s)).length || 0;
  const hasPendingChanges = Object.keys(pendingToggles).length > 0;

  // Filter skills by search
  const filteredCategories = Object.entries(categories).reduce(
    (acc, [cat, skills]) => {
      const filtered = skills.filter(
        (s) =>
          !search ||
          s.name.toLowerCase().includes(search.toLowerCase()) ||
          s.description.toLowerCase().includes(search.toLowerCase())
      );
      if (filtered.length > 0) acc[cat] = filtered;
      return acc;
    },
    {} as Record<string, Skill[]>
  );

  return (
    <div className="min-h-screen bg-dark-950 grid-bg">
      {toastElement}
      <PageHeader
        icon={FileText}
        title="Skills Manager"
        subtitle={`${enabledCount}/${data?.total || 0} enabled — ${data?.categoryCount || 0} categories`}
        color="green"
        actions={
          <div className="flex items-center gap-3">
            <select
              value={selectedProfile}
              onChange={(e) => setSelectedProfile(e.target.value)}
              aria-label="Agent profile"
              className="bg-dark-800 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:border-green-500/50 focus:outline-none"
            >
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            {hasPendingChanges && (
              <Button variant="primary" color="green" size="sm" icon={Save} onClick={saveToggles} disabled={saving}>
                {saving ? "Saving..." : `Save (${Object.keys(pendingToggles).length})`}
              </Button>
            )}
          </div>
        }
      />

      <div className="px-6 py-6">
        {/* Full Width Search */}
        <div className="mb-6">
          <SearchInput value={search} onChange={setSearch} placeholder="Search skills..." accentColor="green" />
        </div>

        {loading ? (
          <LoadingSpinner text="Loading skills..." />
        ) : Object.keys(filteredCategories).length === 0 ? (
          <EmptyState icon={FileText} title="No skills found" description={search ? "Try a different search" : "No skills installed"} />
        ) : (
          <div className="space-y-3">
            {Object.entries(filteredCategories).map(([category, skills]) => {
              const isExpanded = expandedCategories[category] ?? false;
              const catEnabled = skills.filter((s) => isSkillEnabled(s)).length;
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
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-white/30" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-white/30" />
                      )}
                      <span className="text-sm font-semibold text-white/70">{category || "uncategorized"}</span>
                      <Badge color="gray" size="sm">{catEnabled}/{skills.length}</Badge>
                    </div>
                  </button>

                  {/* Skills List */}
                  {isExpanded && (
                    <div className="border-t border-white/5">
                      {skills.map((skill) => {
                        const enabled = isSkillEnabled(skill);
                        const isPending = skill.name in pendingToggles;
                        const isSkillExpanded = expandedSkill === skill.name;
                        return (
                          <div key={skill.name}>
                            <div
                              className={`flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 transition-colors group ${
                                !enabled ? "opacity-50" : ""
                              } ${isPending ? "ring-1 ring-green-500/30" : ""}`}
                            >
                              <button onClick={() => toggleSkill(skill.name, enabled)} className="flex-shrink-0">
                                {enabled ? (
                                  <ToggleRight className="w-6 h-6 text-neon-green" />
                                ) : (
                                  <ToggleLeft className="w-6 h-6 text-white/20" />
                                )}
                              </button>
                              <div className="flex-1 min-w-0 max-w-[200px]">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-mono text-white/80">{skill.name}</span>
                                  {isPending && (
                                    <Badge color="green" size="sm">
                                      {pendingToggles[skill.name] ? "enabling" : "disabling"}
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-xs text-white/30 truncate" title={skill.description}>{skill.description}</p>
                              </div>
                              <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button variant="ghost" size="sm" icon={Eye} onClick={() => viewSkill(skill)}>
                                  {isSkillExpanded ? "Hide" : "View"}
                                </Button>
                              </div>
                            </div>
                            {isSkillExpanded && (
                              <div className="ml-12 mr-4 mb-2 p-3 bg-dark-800/50 border border-white/5 rounded-lg">
                                <pre className="text-xs text-white/60 font-mono whitespace-pre-wrap max-h-60 overflow-auto">
                                  {skillContent || "// Loading..."}
                                </pre>
                              </div>
                            )}
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
      </div>
    </div>
  );
}
