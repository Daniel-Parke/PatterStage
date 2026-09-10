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
import Card, { StatusDot } from "@/components/ui/Card";
import IconButton from "@/components/ui/IconButton";
import LoadErrorBanner from "@/components/ui/LoadErrorBanner";
import { Input } from "@/components/ui/field";
import { Panel } from "@/components/dashboard/Panel";
import { LedgerRowButton } from "@/components/dashboard/LedgerRow";
import CategoryAccordion from "@/components/ui/CategoryAccordion";
import SegmentedControl from "@/components/ui/SegmentedControl";
import TemplatePill from "@/components/ui/TemplatePill";
import CollapsibleSection from "@/components/ui/CollapsibleSection";
import { EmptyState } from "@/components/ui/EmptyState";
import Button from "@/components/ui/Button";
import { useState } from "react";
import { statusToneClasses } from "@/lib/theme";
import {
  CATEGORY_COLOR_CLASSES,
  resolveCategoryDisplay,
  buildCategoryMap,
} from "@/lib/missions/mission-categories";

import type { MissionsPageViewModel } from "@/hooks/useMissionsPage";
import type { MissionRow } from "@/hooks/missions-page-types";
import {
  FALLBACK_CATEGORY_ACTIVE,
  RUN_TONE_TEXT,
  STATUS_CONFIG,
} from "./mission-page-constants";
import {
  MISSION_BOARD_COLUMNS,
  countMissionsByColumn,
  missionBoardColumn,
} from "@/lib/missions/mission-board";
import { MISSION_COLUMN_LABELS } from "@/lib/status-labels";
import { describeMissionRunState } from "@/lib/missions/mission-run-state";
import MissionEditorPanel from "./MissionEditorPanel";
import ConceptHint from "@/components/help/ConceptHint";

// The board's columns are the board module's, and so are its counts: a second
// list here is how the strip beside it ended up in a second vocabulary
// (T-0104, C126).

export interface MissionsListProps {
  vm: MissionsPageViewModel;
}

export default function MissionsList({ vm }: MissionsListProps) {
  const {
    missions,
    templates,
    openCreate,
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
  // One pass for the badges, and the same function the strip above reads.
  const columnCounts = countMissionsByColumn(filtered);
  // The templates are a collapsed disclosure: on the busiest screen the board
  // started 500px below the fold, under a heading, a blurb, a segmented control
  // and eight accordions (the review of 2026-09-08). Closed until asked; the
  // empty state's "Load a template" asks (T-0133).
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const templateCount = templates?.length ?? 0;

  return (
    <div>
      {/* The status summary is rendered once by <MissionInsights> above this
          list, off the same countMissionsByColumn call this board uses. */}
      {!showCreate && (
        <div className="mb-6" data-testid="missions-quick-templates">
          <CollapsibleSection
            title="Quick load template"
            badge={`${templateCount} template${templateCount === 1 ? "" : "s"}`}
            badgeColor="cyan"
            expanded={templatesOpen}
            onExpandedChange={setTemplatesOpen}
          >
          <div className="flex flex-wrap justify-between items-start gap-4 mb-3">
            <p className="text-body text-ps-text-muted">
              Prefill the <ConceptHint id="mission">mission</ConceptHint> form; review and dispatch
              when ready.
            </p>
            <div className="flex flex-wrap items-center gap-3 shrink-0">
              {/* 16px of text was the whole target on both of these (T-0128). */}
              <button
                type="button"
                onClick={openCategoryManager}
                className="inline-flex min-h-6.5 items-center text-micro font-mono text-ps-text-muted hover:text-neon-cyan"
              >
                Manage categories
              </button>
              <button
                type="button"
                onClick={openTemplateManager}
                className="text-micro font-mono text-ps-text-muted hover:text-neon-cyan flex min-h-6.5 items-center gap-1 transition-colors"
              >
                <Layers className="w-3 h-3" />
                Edit Templates
              </button>
            </div>
          </div>
          {templateCategoryPills.length <= 1 && (
            <p className="text-micro text-ps-text-faint font-mono mb-4">
              Category filters appear when you have templates in more than one
              category.
            </p>
          )}
          {templateCategoryPills.length > 1 && (
            <>
              <p className="text-micro font-mono text-ps-text-faint uppercase tracking-widest mb-2">
                Template categories
              </p>
              <div className="mb-4">
                <SegmentedControl
                  label="Template categories"
                  options={[
                    { value: "all", label: "All" },
                    ...templateCategoryPills.map((pill) => ({
                      value: pill.id,
                      label: pill.name,
                      count: pill.count,
                    })),
                  ]}
                  value={categoryFilter}
                  onChange={setCategoryFilter}
                />
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
          </CollapsibleSection>
        </div>
      )}

      <div className="flex flex-col gap-3 mb-4">
        {missionCategoryPills.length > 0 && (
          <SegmentedControl
            label="Mission categories"
            options={[
              { value: "all", label: "All missions" },
              ...missionCategoryPills.map((pill) => ({
                value: pill.id,
                label: pill.name,
                count: pill.count,
              })),
            ]}
            value={missionCategoryFilter}
            onChange={setMissionCategoryFilter}
          />
        )}
        <div className="flex flex-wrap items-center gap-3">
          <SegmentedControl
            label="Status"
            options={[
              { value: "all", label: "All", count: filtered.length },
              ...MISSION_BOARD_COLUMNS.map((status) => ({
                value: status,
                label: MISSION_COLUMN_LABELS[status],
                count: columnCounts[status],
              })),
            ]}
            value={filter}
            onChange={setFilter}
          />
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ps-viz-glyph-idle" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search missions..."
              aria-label="Mission search"
              className="pl-9 pr-8 font-mono"
            />
            {search && (
              <IconButton
                icon={X}
                label="Clear the mission search"
                size="sm"
                onClick={() => setSearch("")}
                className="absolute right-1.5 top-1/2 -translate-y-1/2"
              />
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
        // The first action one click from the top: an empty board used to be
        // a sentence under 500px of templates (T-0133).
        <EmptyState
          icon={Rocket}
          title={missions.length === 0 ? "No missions yet" : "No missions match your filter"}
          description={missions.length === 0 ? "Create one, or load a template to prefill the form." : undefined}
          action={
            missions.length === 0 ? (
              <div className="flex flex-wrap justify-center gap-2">
                <Button variant="primary" color="cyan" size="sm" icon={Rocket} onClick={openCreate}>
                  New Mission
                </Button>
                <Button variant="secondary" color="cyan" size="sm" icon={Zap} onClick={() => setTemplatesOpen(true)}>
                  Load a template
                </Button>
              </div>
            ) : undefined
          }
        />
      ) : (
        <div
          data-testid="missions-board"
          className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
        >
          {MISSION_BOARD_COLUMNS.map(
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
                  className="flex min-w-0 flex-col"
                >
                  <div className="flex items-center justify-between mb-3 px-1">
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-2 h-2 rounded-full ${sc?.columnDot || statusToneClasses.idle.dot}`}
                      />
                      <span className="text-micro font-mono text-ps-text-muted uppercase tracking-wider">
                        {MISSION_COLUMN_LABELS[status]}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {(status === "successful" || status === "failed") &&
                        columnMissions.length > 5 && (
                          <button
                            type="button"
                            onClick={toggleCollapsedColumn}
                            className="text-micro font-mono text-ps-text-faint hover:text-neon-cyan transition-colors"
                          >
                            {collapsedColumns[status] ? "Show all" : "Collapse"}
                          </button>
                        )}
                      <span
                        className={`text-micro font-mono px-2 py-0.5 rounded-full ${sc?.bg} ${sc?.text}`}
                      >
                        {columnCounts[status]}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-2 flex-1">
                    {columnMissions.length === 0 ? (
                      <Card className="border-dashed text-center text-micro font-mono text-ps-text-faint">
                        No missions
                      </Card>
                    ) : (
                      <>
                        {/* One container per COLUMN, not per mission. A mission
                            row carries a name, a category, a run state and a
                            cron result, which WG-WEB-003 (D) rules is a ledger;
                            the column is the panel and the divider is what
                            separates two missions (T-0033). */}
                        <Panel>
                          <div className="divide-y divide-ps-edge-hairline">
                            {visibleMissions.map((mission: MissionRow) => {
                              const rowStatus =
                                STATUS_CONFIG[mission.status] || {
                                  dot: "idle" as const,
                                  bg: "bg-ps-surface-raised",
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
                                          <span className="text-body font-semibold text-ps-text-primary truncate">
                                            {mission.name}
                                          </span>
                                          {mission.categoryId && (
                                            <span
                                              className={`text-micro font-mono px-1.5 py-0.5 rounded-full border ${
                                                CATEGORY_COLOR_CLASSES[
                                                  catDisplay.color
                                                ] ?? FALLBACK_CATEGORY_ACTIVE
                                              }`}
                                            >
                                              {catDisplay.name}
                                            </span>
                                          )}
                                        </div>
                                        <div className="flex items-center gap-2 mt-1.5 text-micro font-mono text-ps-text-faint flex-wrap">
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
                                            mission.scheduleStatus?.lastStatus && (
                                              <span
                                                className={
                                                  mission.scheduleStatus.lastStatus ===
                                                  "ok"
                                                    ? statusToneClasses.ok.text
                                                    : statusToneClasses.fail.text
                                                }
                                              >
                                                {mission.scheduleStatus.lastStatus}
                                              </span>
                                            )}
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-1 flex-shrink-0">
                                        {STATUS_CONFIG[mission.status]?.icon ?? null}
                                        <ChevronRight
                                          className={`w-3.5 h-3.5 text-ps-viz-glyph-idle transition-transform ${isExpanded ? "rotate-90" : ""}`}
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
                              className="w-full text-micro font-mono text-neon-cyan/80 hover:text-neon-cyan py-2 text-center border border-dashed border-ps-edge rounded-ps-md transition-colors mt-2"
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
