// ══════════════════════════════════════════════════════════════════════════════
// Skills Manager — Active / Inactive two-section layout with live toggle
// ══════════════════════════════════════════════════════════════════════════════

"use client";

import { useState, useEffect, useCallback } from "react";
import {
  FileText, ToggleRight, ToggleLeft, X, ChevronDown, ChevronRight,
} from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import { SearchInput } from "@/components/ui/Input";
import { LoadingSpinner, EmptyState } from "@/components/ui/LoadingSpinner";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import ProfileSelector from "@/components/ui/ProfileSelector";

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
  const [selectedProfile, setSelectedProfile] = useState("default");

  // Per-category collapse state — default collapsed (value is true when collapsed)
  const [categoryCollapsed, setCategoryCollapsed] = useState<Record<string, boolean>>({});
  // Per-section collapse state — Active open by default
  const [activeCollapsed, setActiveCollapsed] = useState(false);
  const [inactiveCollapsed, setInactiveCollapsed] = useState(true);

  const toggleCategory = (cat: string) =>
    setCategoryCollapsed((prev) => ({ ...prev, [cat]: !prev[cat] }));

  // Per-section search
  const [activeSearch, setActiveSearch] = useState("");
  const [inactiveSearch, setInactiveSearch] = useState("");

  // Expanded skill for content preview
  const [expandedSkill, setExpandedSkill] = useState<string | null>(null);
  const [skillContent, setSkillContent] = useState<string>("");

  // Optimistic toggle state — key: skillName, value: the effective (pending) enabled state
  const [toggling, setToggling] = useState<Record<string, boolean>>({});

  const { showToast, toastElement } = useToast();

  const loadSkills = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/skills?profile=${selectedProfile}`);
      const d = await res.json();
      setData(d.data);
      // Seed all categories as collapsed on first load
      const cats = Object.keys(d.data.categories || {});
      setCategoryCollapsed(Object.fromEntries(cats.map((c) => [c, true])));
    } catch {
      showToast("Failed to load skills", "error");
    } finally {
      setLoading(false);
    }
  }, [selectedProfile, showToast]);

  useEffect(() => { loadSkills(); }, [loadSkills]);

  // ── Helpers ─────────────────────────────────────────────────────────────────

  const effectiveEnabled = (skill: Skill) =>
    skill.name in toggling ? toggling[skill.name] : skill.enabled;

  const activeSkills = (data?.skills || []).filter((s) => effectiveEnabled(s));
  const inactiveSkills = (data?.skills || []).filter((s) => !effectiveEnabled(s));

  const filterBySearch = (skills: Skill[], search: string) =>
    skills.filter(
      (s) =>
        !search ||
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.description.toLowerCase().includes(search.toLowerCase()),
    );

  // Group skills by category, sorted alphabetically; skills within each category sorted alphabetically
  const groupByCategory = (skills: Skill[]) => {
    const groups: Record<string, Skill[]> = {};
    for (const s of skills) {
      const cat = s.category || "Other";
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(s);
    }
    return Object.entries(groups)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([category, items]) => ({
        category,
        skills: items.sort((x, y) => x.name.localeCompare(y.name)),
      }));
  };

  // ── Toggle — fires API immediately, optimistic update, reverts on failure ───

  const toggleSkill = useCallback(
    async (skillName: string, currentEnabled: boolean) => {
      const next = !currentEnabled;
      // Optimistic
      setToggling((prev) => ({ ...prev, [skillName]: next }));
      try {
        const res = await fetch(`/api/skills/${encodeURIComponent(skillName)}/toggle`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ profile: selectedProfile, enabled: next }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error((body as { error?: string })?.error || `HTTP ${res.status}`);
        }
        // Commit to server state
        setData((prev) =>
          prev
            ? {
                ...prev,
                skills: prev.skills.map((s) =>
                  s.name === skillName ? { ...s, enabled: next } : s,
                ),
              }
            : prev,
        );
        // Clear pending toggle
        setToggling((prev) => {
          const next2 = { ...prev };
          delete next2[skillName];
          return next2;
        });
        showToast(
          next ? `${skillName} enabled` : `${skillName} disabled`,
          "success",
        );
      } catch (err) {
        // Revert optimistic update
        setToggling((prev) => {
          const next2 = { ...prev };
          delete next2[skillName];
          return next2;
        });
        showToast(err instanceof Error ? err.message : "Failed to update skill", "error");
      }
    },
    [selectedProfile, showToast],
  );

  // ── Skill content preview ───────────────────────────────────────────────────

  const viewSkill = async (skill: Skill) => {
    if (expandedSkill === skill.name) {
      setExpandedSkill(null);
      setSkillContent("");
      return;
    }
    setExpandedSkill(skill.name);
    try {
      const res = await fetch(
        `/api/skills/${encodeURIComponent(skill.name)}?profile=${selectedProfile}`,
      );
      const d = await res.json();
      if (!res.ok) {
        setSkillContent("// " + (d?.error || res.statusText || "Failed to load"));
        return;
      }
      setSkillContent(d.data?.content || "// No content");
    } catch {
      setSkillContent("// Failed to load content");
    }
  };

  // ── Section counts ─────────────────────────────────────────────────────────

  const total = data?.skills.length || 0;
  const activeFiltered = filterBySearch(activeSkills, activeSearch);
  const inactiveFiltered = filterBySearch(inactiveSkills, inactiveSearch);

  return (
    <div className="min-h-screen bg-dark-950 grid-bg">
      {toastElement}
      <PageHeader
        icon={FileText}
        title="Skills Manager"
        subtitle={`${total} skill${total !== 1 ? "s" : ""} across ${data?.categoryCount ?? 0} categor${data?.categoryCount !== 1 ? "ies" : "y"}`}
        color="green"
        actions={
          <ProfileSelector
            value={selectedProfile}
            onChange={(id) => setSelectedProfile(id)}
            compact={false}
          />
        }
      />

      <div className="px-6 py-4">
        {loading ? (
          <LoadingSpinner text="Loading skills..." />
        ) : total === 0 ? (
          <EmptyState
            icon={FileText}
            title="No skills found"
            description="No skill files were found in the configured skills directory."
          />
        ) : (
          <div className="flex flex-col gap-6">
            {/* ── Active Skills ── */}
            <SkillSection
              title="Active"
              icon={ToggleRight}
              iconColor="text-neon-green"
              count={activeFiltered.length}
              ofTotal={activeSkills.length}
              collapsed={activeCollapsed}
              onToggleCollapse={() => setActiveCollapsed((v) => !v)}
              search={
                <SearchInput
                  value={activeSearch}
                  onChange={setActiveSearch}
                  placeholder="Search active skills..."
                  accentColor="green"
                />
              }
            >
              {activeFiltered.length === 0 ? (
                <EmptyState
                  icon={ToggleRight}
                  title="No active skills"
                  description={
                    activeSearch
                      ? "No active skills match your search"
                      : "Toggle skills below to enable them"
                  }
                />
              ) : (
                <div className="space-y-5">
                  {groupByCategory(activeFiltered).map(({ category, skills }) => {
                    const isCollapsed = categoryCollapsed[category];
                    return (
                      <div key={category}>
                        <CategoryLabel
                          category={category}
                          count={skills.length}
                          accentColor="text-neon-green/50"
                          collapsed={isCollapsed}
                          onToggle={() => toggleCategory(category)}
                        />
                        {!isCollapsed && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-2">
                            {skills.map((skill) => (
                              <SkillCard
                                key={skill.name}
                                skill={skill}
                                enabled
                                isExpanded={expandedSkill === skill.name}
                                isPending={skill.name in toggling}
                                onToggle={() => toggleSkill(skill.name, true)}
                                onView={() => viewSkill(skill)}
                                expandedContent={
                                  expandedSkill === skill.name ? skillContent : undefined
                                }
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </SkillSection>

            {/* ── Inactive Skills ── */}
            <SkillSection
              title="Inactive"
              icon={ToggleLeft}
              iconColor="text-white/30"
              count={inactiveFiltered.length}
              ofTotal={inactiveSkills.length}
              collapsed={inactiveCollapsed}
              onToggleCollapse={() => setInactiveCollapsed((v) => !v)}
              search={
                <SearchInput
                  value={inactiveSearch}
                  onChange={setInactiveSearch}
                  placeholder="Search inactive skills..."
                  accentColor="white"
                />
              }
            >
              {inactiveFiltered.length === 0 ? (
                <EmptyState
                  icon={ToggleLeft}
                  title="No inactive skills"
                  description={
                    inactiveSearch
                      ? "No inactive skills match your search"
                      : "All skills are currently active"
                  }
                />
              ) : (
                <div className="space-y-5">
                  {groupByCategory(inactiveFiltered).map(({ category, skills }) => {
                    const isCollapsed = categoryCollapsed[category];
                    return (
                      <div key={category}>
                        <CategoryLabel
                          category={category}
                          count={skills.length}
                          accentColor="text-white/30"
                          collapsed={isCollapsed}
                          onToggle={() => toggleCategory(category)}
                        />
                        {!isCollapsed && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-2">
                            {skills.map((skill) => (
                              <SkillCard
                                key={skill.name}
                                skill={skill}
                                enabled={false}
                                isExpanded={expandedSkill === skill.name}
                                isPending={skill.name in toggling}
                                onToggle={() => toggleSkill(skill.name, false)}
                                onView={() => viewSkill(skill)}
                                expandedContent={
                                  expandedSkill === skill.name ? skillContent : undefined
                                }
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </SkillSection>
          </div>
        )}
      </div>
    </div>
  );
}

// ── CategoryLabel ───────────────────────────────────────────────────────────────

interface CategoryLabelProps {
  category: string;
  count: number;
  accentColor: string;
  collapsed: boolean;
  onToggle: () => void;
}

function CategoryLabel({ category, count, accentColor, collapsed, onToggle }: CategoryLabelProps) {
  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center gap-2 group cursor-pointer py-0.5"
      title={collapsed ? `Expand ${category}` : `Collapse ${category}`}
    >
      <ChevronRight
        className={`w-3 h-3 flex-shrink-0 text-white/20 group-hover:text-white/50 transition-all ${
          collapsed ? "" : "rotate-90"
        }`}
      />
      <span className={`text-[10px] font-mono font-semibold uppercase tracking-widest ${accentColor}`}>
        {category}
      </span>
      <span className={`text-[10px] font-mono ${accentColor}`}>
        ({count})
      </span>
      <div className={`h-px flex-1 bg-gradient-to-r from-white/10 to-transparent ${accentColor.replace("/50", "/5").replace("/30", "/5")}`} />
    </button>
  );
}

// ── SkillSection ──────────────────────────────────────────────────────────────

interface SkillSectionProps {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  count: number;
  ofTotal: number;
  collapsed: boolean;
  onToggleCollapse: () => void;
  search: React.ReactNode;
  children: React.ReactNode;
}

function SkillSection({
  title,
  icon: Icon,
  iconColor,
  count,
  ofTotal,
  collapsed,
  onToggleCollapse,
  search,
  children,
}: SkillSectionProps) {
  return (
    <div>
      {/* Section header */}
      <button
        onClick={onToggleCollapse}
        className="w-full flex items-center justify-between mb-3 px-4 py-2.5 rounded-xl border border-white/10 bg-dark-900/40 hover:bg-dark-900/80 hover:border-white/20 transition-all cursor-pointer group"
      >
        <div className="flex items-center gap-2.5">
          <Icon className={`w-4 h-4 ${iconColor}`} />
          <span className="text-sm font-semibold text-white/80">{title}</span>
          <Badge color={count > 0 ? "green" : "gray"} size="sm">
            {count}
            {count !== ofTotal ? `/${ofTotal}` : ""}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-white/25 group-hover:text-white/40 transition-colors">
            {collapsed ? "expand" : "collapse"}
          </span>
          <ChevronRight
            className={`w-4 h-4 text-white/30 group-hover:text-white/60 transition-all ${
              collapsed ? "" : "rotate-90"
            }`}
          />
        </div>
      </button>

      {/* Collapsible body */}
      {!collapsed && (
        <div className="space-y-3">
          {/* Section search */}
          <div className="max-w-xs">{search}</div>

          {/* Skill cards */}
          {children}
        </div>
      )}
    </div>
  );
}

// ── SkillCard ────────────────────────────────────────────────────────────────

interface SkillCardProps {
  skill: Skill;
  enabled: boolean;
  isExpanded: boolean;
  isPending: boolean;
  onToggle: () => void;
  onView: () => void;
  expandedContent?: string;
}

function SkillCard({
  skill,
  enabled,
  isExpanded,
  isPending,
  onToggle,
  onView,
  expandedContent,
}: SkillCardProps) {
  return (
    <Card
      className={`relative overflow-hidden transition-all border-white/10 ${
        isPending ? "ring-1 ring-neon-green/30" : ""
      }`}
      glow={enabled ? "green" : undefined}
      padding="none"
    >
      {/* Left accent bar */}
      <div
        className={`absolute left-0 top-0 bottom-0 w-0.5 rounded-l-xl ${
          enabled ? "bg-neon-green" : "bg-white/20"
        }`}
      />

      <div className="p-3 pl-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-mono font-semibold text-white/80 truncate">
                {skill.name}
              </span>
              {isPending && (
                <Badge color="green" size="sm">
                  Updating...
                </Badge>
              )}
            </div>
            <p className="text-[10px] text-white/30 font-mono mt-0.5">
              {skill.category}
            </p>
          </div>

          {/* Toggle */}
          <button
            onClick={onToggle}
            disabled={isPending}
            className="flex-shrink-0 mt-0.5 disabled:opacity-40"
            title={enabled ? "Disable skill" : "Enable skill"}
          >
            {enabled ? (
              <ToggleRight className="w-7 h-7 text-neon-green" />
            ) : (
              <ToggleLeft className="w-7 h-7 text-white/20" />
            )}
          </button>
        </div>

        {/* Description */}
        <p
          className="text-xs text-white/40 leading-relaxed line-clamp-2 mb-3"
          title={skill.description}
        >
          {skill.description}
        </p>

        {/* Footer row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {enabled ? (
              <span className="inline-flex items-center gap-1 text-[10px] text-neon-green/70">
                <span className="w-1.5 h-1.5 rounded-full bg-neon-green animate-pulse" />
                Active
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[10px] text-white/30">
                <span className="w-1.5 h-1.5 rounded-full bg-white/20" />
                Inactive
              </span>
            )}
          </div>

          <button
            onClick={onView}
            className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded border transition-all ${
              isExpanded
                ? "border-white/20 text-white/50 bg-white/5"
                : "border-white/10 text-white/30 hover:border-white/20 hover:text-white/60"
            }`}
          >
            {isExpanded ? (
              <>
                <X className="w-3 h-3" /> Hide
              </>
            ) : (
              <>
                <ChevronDown className="w-3 h-3" /> View
              </>
            )}
          </button>
        </div>

        {/* Expanded content */}
        {isExpanded && (
          <div className="mt-3 pt-3 border-t border-white/5">
            <pre className="text-[11px] text-white/50 font-mono whitespace-pre-wrap max-h-48 overflow-auto leading-relaxed">
              {expandedContent ?? "// Loading..."}
            </pre>
          </div>
        )}
      </div>
    </Card>
  );
}
