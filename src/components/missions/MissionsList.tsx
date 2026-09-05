"use client";

import {
  AlertTriangle,
  ChevronRight,
  Clock,
  Layers,
  Rocket,
  Search,
  X,
  Zap,
} from "lucide-react";
import { StatusDot } from "@/components/ui/Card";
import LoadErrorBanner from "@/components/ui/LoadErrorBanner";
import { Panel } from "@/components/dashboard/Panel";
import { LedgerRowButton } from "@/components/dashboard/LedgerRow";
import CategoryAccordion from "@/components/ui/CategoryAccordion";
import TemplatePill from "@/components/ui/TemplatePill";
import {
  CATEGORY_COLOR_CLASSES,
  resolveCategoryDisplay,
  buildCategoryMap,
} from "@/lib/missions/mission-categories";
import { titleCase } from "@/lib/utils";
import type { MissionsPageViewModel } from "@/hooks/useMissionsPage";
import type { MissionRow } from "@/hooks/missions-page-types";
import {
  FALLBACK_CATEGORY_ACTIVE,
  RUN_TONE_TEXT,
  STATUS_CONFIG,
} from "./mission-page-constants";
import { missionBoardColumn } from "@/lib/missions/mission-board";
import { describeMissionRunState } from "@/lib/missions/mission-run-state";
import MissionEditorPanel from "./MissionEditorPanel";

const STATUS_FILTERS = ["all", "draft", "queued", "dispatched", "successful", "failed"] as const;
const BOARD_COLUMNS = ["draft", "queued", "dispatched", "successful", "failed"] as const;

export interface MissionsListProps {
  vm: MissionsPageViewModel;
}

export default function MissionsList({ vm }: MissionsListProps) {
  const {
    missions,
    showCreate,
    filter,
    setFilter,
    search,
    setSearch,
    expandedId,
    setExpandedId,
    detail,
    detailLoading,
    promptCollapsed,
    setPromptCollapsed,
    collapsedColumns,
    setCollapsedColumns,
    categoryFilter,
    setCategoryFilter,
    missionCategoryFilter,
    setMissionCategoryFilter,
    templateCategoryPills,
    missionCategoryPills,
    filteredGrouped,
    filtered,
    categories,
    handleTemplateSelect,
    openTemplateManager,
    openCategoryManager,
    handleEdit,
    handleDelete,
    handleCancel,
    handleDuplicateMission,
    cancellingMissionId,
    missionsLoadError,
    fetchData,
  } = vm;

  const categoryMap = buildCategoryMap(categories);
  // One clock reading for the whole board, so every card's duration is
  // measured from the same instant. The missions page repolls every 15s,
  // which is what advances these numbers.
  /* eslint-disable-next-line react-hooks/purity -- live durations read the wall clock; the 15s poll re-renders the board */
  const renderedAt = Date.now();

  return (
    <div className="w-full max-w-none px-6 py-6">
      {/* The status summary (Total / Active / Done / Failed) is rendered once by
          <MissionInsights> above this list — no duplicate tile row here. */}
      {!showCreate && (
        <div className="mb-6" data-testid="missions-quick-templates">
          <div className="flex flex-wrap justify-between items-start gap-4 mb-3">
            <div>
              <h2 className="text-sm font-mono text-ps-text-muted uppercase tracking-widest flex items-center gap-2">
                <Zap className="w-3 h-3 text-neon-cyan" />
                Quick load template
              </h2>
              <p className="text-xs text-ps-text-muted mt-1 font-mono">
                Prefill the mission form — review and dispatch when ready
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={openCategoryManager}
                className="text-xs font-mono text-ps-text-muted hover:text-neon-cyan"
              >
                Manage categories
              </button>
              <button
                type="button"
                onClick={openTemplateManager}
                className="text-xs font-mono text-ps-text-muted hover:text-neon-cyan flex items-center gap-1 transition-colors"
              >
                <Layers className="w-3 h-3" />
                Edit Templates
              </button>
            </div>
          </div>
          {templateCategoryPills.length <= 1 && (
            <p className="text-xs text-ps-text-faint font-mono mb-4">
              Category filters appear when you have templates in more than one
              category.
            </p>
          )}
          {templateCategoryPills.length > 1 && (
            <>
              <p className="text-xs font-mono text-ps-text-faint uppercase tracking-widest mb-2">
                Template categories
              </p>
              <div className="flex flex-wrap gap-2 mb-4">
                <button
                  type="button"
                  onClick={() => setCategoryFilter("all")}
                  className={`px-3 py-1 rounded-full text-xs font-mono transition-colors ${
                    categoryFilter === "all"
                      ? FALLBACK_CATEGORY_ACTIVE
                                            : "text-ps-text-muted border border-white/10 hover:text-ps-text-secondary hover:border-white/20"
                  }`}
                >
                  All
                </button>
                {templateCategoryPills.map((pill) => {
                  const active = categoryFilter === pill.id;
                  return (
                    <button
                      type="button"
                      key={pill.id}
                      onClick={() => setCategoryFilter(pill.id)}
                      className={`px-3 py-1 rounded-full text-xs font-mono transition-colors ${
                        active
                          ? (CATEGORY_COLOR_CLASSES[pill.color] ?? FALLBACK_CATEGORY_ACTIVE)
                          : "text-ps-text-muted border border-white/10 hover:text-ps-text-secondary hover:border-white/20"
                      }`}
                    >
                      {pill.name} ({pill.count})
                    </button>
                  );
                })}
              </div>
            </>
          )}
          <div className="space-y-2">
            {filteredGrouped.map((group) => (
              <CategoryAccordion
                key={group.categoryId ?? "__none__"}
                name={group.label}
                count={group.items.length}
                color={group.color}
                expandable={true}
                defaultOpen={
                  categoryFilter !== "all"
                    ? true
                    : filteredGrouped.length <= 3
                }
              >
                <div className="flex flex-wrap gap-1.5">
                  {group.items.map((t) => (
                    <TemplatePill
                      key={t.id}
                      t={t}
                      onSelect={() => handleTemplateSelect(t)}
                    />
                  ))}
                </div>
              </CategoryAccordion>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3 mb-4">
        {missionCategoryPills.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setMissionCategoryFilter("all")}
              className={`px-3 py-1 rounded-full text-xs font-mono transition-colors ${
                missionCategoryFilter === "all"
                  ? FALLBACK_CATEGORY_ACTIVE
                                        : "text-ps-text-muted border border-white/10 hover:text-ps-text-secondary hover:border-white/20"
              }`}
            >
              All missions
            </button>
            {missionCategoryPills.map((pill) => {
              const active = missionCategoryFilter === pill.id;
              return (
                <button
                  type="button"
                  key={pill.id}
                  onClick={() => setMissionCategoryFilter(pill.id)}
                  className={`px-3 py-1 rounded-full text-xs font-mono transition-colors ${
                    active
                      ? (CATEGORY_COLOR_CLASSES[pill.color] ?? FALLBACK_CATEGORY_ACTIVE)
                      : "text-ps-text-muted border border-white/10 hover:text-ps-text-secondary hover:border-white/20"
                  }`}
                >
                  {pill.name} ({pill.count})
                </button>
              );
            })}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 bg-dark-900/50 rounded-lg border border-white/10 p-1">
            {STATUS_FILTERS.map(
              (f) => (
                <button
                  type="button"
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-2.5 py-1 rounded-md text-xs font-mono capitalize transition-colors ${
                    filter === f
                      ? "bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/30"
                      : "text-ps-text-muted hover:text-ps-text-muted border border-transparent"
                  }`}
                >
                  {f}
                </button>
              ),
            )}
          </div>
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/20" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search missions..." aria-label="Mission search"
              className="w-full bg-dark-900/50 border border-white/10 rounded-lg pl-9 pr-8 py-1.5 text-xs text-white placeholder-white/20 outline-none focus:border-neon-cyan/50 font-mono"
            />
            {search && (
              <button
                type="button"
                aria-label="Clear the mission search"
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-ps-text-muted hover:text-ps-text-secondary transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* The read contract (T-0096, D67): a failed read is this banner with a
          Retry, never the first-run empty state under it. */}
      {missionsLoadError && (
        <LoadErrorBanner error={missionsLoadError} onRetry={() => void fetchData()} />
      )}
      {missionsLoadError ? null : filtered.length === 0 ? (
        <div className="text-center py-12">
          <Rocket className="w-10 h-10 text-white/10 mx-auto mb-3" />
          <div className="text-sm text-ps-text-muted">
            {missions.length === 0
              ? "No missions yet - create one to get started"
              : "No missions match your filter"}
          </div>
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row gap-4 overflow-x-auto pb-2">
          {BOARD_COLUMNS.map(
            (status) => {
              const columnMissions = filtered.filter(
                (m) => missionBoardColumn(m) === status,
              );
              const sc = STATUS_CONFIG[status];
              const isCollapsible =
                (status === "successful" || status === "failed") &&
                columnMissions.length > 5;
              // Closure over `status` + the `setCollapsedColumns` updater.
              // The 2 inline call sites below (column header "Collapse /
              // Show all" button + the "Show all N missions" footer
              // button) use the same `setCollapsedColumns((prev) => ({
              // ...prev, [status]: !prev[status] }))` shape. The
              // `toggleCollapsedColumn` helper centralises the
              // `setCollapsedColumns` updater + the key spread, so a
              // future "also persist to localStorage" or "also fire
              // analytics" extension lands in one place.
              const toggleCollapsedColumn = () =>
                setCollapsedColumns((prev) => ({
                  ...prev,
                  [status]: !prev[status],
                }));
              const visibleMissions =
                isCollapsible && collapsedColumns[status]
                  ? columnMissions.slice(0, 5)
                  : columnMissions;
              if (filter !== "all" && filter !== status) return null;
              return (
                <div
                  key={status}
                  className="flex-1 min-w-[240px] flex flex-col"
                >
                  <div className="flex items-center justify-between mb-3 px-1">
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-2 h-2 rounded-full ${sc?.columnDot || "bg-white/20"}`}
                      />
                      <span className="text-xs font-mono text-ps-text-muted uppercase tracking-wider">
                        {status === "successful"
                          ? "Completed"
                          : status === "failed"
                            ? "Failed"
                            : status === "draft"
                              ? "Drafts"
                              : titleCase(status)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {(status === "successful" || status === "failed") &&
                        columnMissions.length > 5 && (
                          <button
                            type="button"
                            onClick={toggleCollapsedColumn}
                            className="text-xs font-mono text-ps-text-faint hover:text-neon-cyan transition-colors"
                          >
                            {collapsedColumns[status] ? "Show all" : "Collapse"}
                          </button>
                        )}
                      <span
                        className={`text-xs font-mono px-2 py-0.5 rounded-full ${sc?.bg} ${sc?.text}`}
                      >
                        {columnMissions.length}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-2 flex-1">
                    {columnMissions.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-white/5 bg-dark-900/20 p-4 text-center text-xs font-mono text-ps-text-faint">
                        No missions
                      </div>
                    ) : (
                      <>
                        {/* One container per COLUMN, not per mission. A mission
                            row carries a name, a category, a run state and a
                            cron result, which WG-WEB-003 (D) rules is a ledger;
                            the column is the panel and the divider is what
                            separates two missions (T-0033). */}
                        <Panel>
                          <div className="divide-y divide-white/5">
                            {visibleMissions.map((mission: MissionRow) => {
                              const rowStatus =
                                STATUS_CONFIG[mission.status] || {
                                  dot: "idle" as const,
                                  bg: "bg-white/5",
                                  text: "text-ps-text-muted",
                                };
                              const isExpanded = expandedId === mission.id;
                              const runState = describeMissionRunState(
                                mission,
                                renderedAt,
                              );
                              const catDisplay = resolveCategoryDisplay(
                                mission.categoryId,
                                categoryMap,
                              );
                              return (
                                <div key={mission.id}>
                                  <LedgerRowButton
                                    padding="none"
                                    onClick={() =>
                                      setExpandedId(isExpanded ? null : mission.id)
                                    }
                                    className="w-full text-left p-3"
                                  >
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                                          <StatusDot
                                            status={rowStatus.dot}
                                            pulse={mission.status === "dispatched"}
                                          />
                                          <span className="text-xs font-semibold text-white truncate">
                                            {mission.name}
                                          </span>
                                          {mission.categoryId && (
                                            <span
                                              className={`text-xs font-mono px-1.5 py-0.5 rounded-full border ${
                                                CATEGORY_COLOR_CLASSES[
                                                  catDisplay.color
                                                ] ?? FALLBACK_CATEGORY_ACTIVE
                                              }`}
                                            >
                                              {catDisplay.name}
                                            </span>
                                          )}
                                        </div>
                                        <div className="flex items-center gap-2 mt-1.5 text-xs font-mono text-ps-text-faint flex-wrap">
                                          {/* "Running 2h 14m" and "Running 12s" are
                                              the same row with different numbers,
                                              which is the point: the card used to
                                              print an unlabelled timeAgo(createdAt)
                                              for every state, so a dispatched
                                              mission read as its own age. */}
                                          <span
                                            className={`flex items-center gap-1 ${RUN_TONE_TEXT[runState.tone]}`}
                                            title={runState.note ?? undefined}
                                          >
                                            <Clock className="w-2.5 h-2.5" />
                                            <span>{runState.label}</span>
                                            <span>{runState.duration}</span>
                                            {runState.tone === "overdue" && (
                                              <AlertTriangle className="w-2.5 h-2.5" />
                                            )}
                                          </span>
                                          {mission.status !== "queued" &&
                                            mission.cronJob?.lastStatus && (
                                              <span
                                                className={
                                                  mission.cronJob.lastStatus ===
                                                  "ok"
                                                    ? "text-neon-green"
                                                    : "text-red-400"
                                                }
                                              >
                                                {mission.cronJob.lastStatus}
                                              </span>
                                            )}
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-1 flex-shrink-0">
                                        {STATUS_CONFIG[mission.status]?.icon ?? null}
                                        <ChevronRight
                                          className={`w-3.5 h-3.5 text-white/20 transition-transform ${isExpanded ? "rotate-90" : ""}`}
                                        />
                                      </div>
                                    </div>
                                  </LedgerRowButton>

                                  {isExpanded && (
                                    <MissionEditorPanel
                                      detail={detail}
                                      detailLoading={detailLoading}
                                      mission={mission}
                                      categoryLabel={catDisplay.name}
                                      promptCollapsed={promptCollapsed}
                                      onPromptCollapsedChange={setPromptCollapsed}
                                      onEdit={handleEdit}
                                      onCancel={handleCancel}
                                      isCancelling={cancellingMissionId === mission.id}
                                      onDelete={handleDelete}
                                      onDuplicate={handleDuplicateMission}
                                    />
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </Panel>
                        {isCollapsible &&
                          collapsedColumns[status] &&
                          columnMissions.length > 5 && (
                            <button
                              type="button"
                              onClick={toggleCollapsedColumn}
                              className="w-full text-xs font-mono text-neon-cyan/80 hover:text-neon-cyan py-2 text-center border border-dashed border-white/5 rounded-lg transition-colors mt-2"
                            >
                              Show all {columnMissions.length} missions →
                            </button>
                          )}
                      </>
                    )}
                  </div>
                </div>
              );
            },
          )}
        </div>
      )}
    </div>
  );
}
