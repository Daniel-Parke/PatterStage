// ═══════════════════════════════════════════════════════════════
// kanban-repository.ts — Kanban board CRUD via SQLite
// ═══════════════════════════════════════════════════════════════

import { db, inTransaction, uuid, now } from "./db";
import type {
  KanbanBoard,
  KanbanColumn,
  KanbanCard,
  KanbanDocument,
} from "@/types/hermes";

// ── Board ─────────────────────────────────────────────────────

export function listBoards(): KanbanBoard[] {
  const rows = db()
    .prepare(
      "SELECT * FROM kanban_boards WHERE deleted_at IS NULL ORDER BY updated_at DESC"
    )
    .all() as BoardRow[];
  return rows.map(rowToBoard);
}

export function getBoard(id: string): KanbanBoard | null {
  const row = db()
    .prepare("SELECT * FROM kanban_boards WHERE id = ?")
    .get(id) as BoardRow | undefined;
  return row ? rowToBoard(row) : null;
}

export function createBoard(data: {
  name: string;
  description?: string;
  teamId?: string;
}): KanbanBoard {
  const id = uuid();
  const ts = now();

  inTransaction(() => {
    db()
      .prepare(
        `INSERT INTO kanban_boards (id, name, description, team_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(id, data.name, data.description ?? "", data.teamId ?? null, ts, ts);
  });

  return getBoard(id)!;
}

export function updateBoard(
  id: string,
  updates: {
    name?: string;
    description?: string;
    teamId?: string;
  }
): KanbanBoard | null {
  const existing = getBoard(id);
  if (!existing) return null;
  const ts = now();

  inTransaction(() => {
    const sets: string[] = ["updated_at = ?"];
    const vals: unknown[] = [ts];
    if (updates.name !== undefined) { sets.push("name = ?"); vals.push(updates.name); }
    if (updates.description !== undefined) { sets.push("description = ?"); vals.push(updates.description); }
    if (updates.teamId !== undefined) { sets.push("team_id = ?"); vals.push(updates.teamId); }
    vals.push(id);
    db()
      .prepare(`UPDATE kanban_boards SET ${sets.join(", ")} WHERE id = ?`)
      .run(...vals);
  });

  return getBoard(id);
}

export function deleteBoard(id: string): boolean {
  const existing = getBoard(id);
  if (!existing) return false;
  const ts = now();
  db()
    .prepare("UPDATE kanban_boards SET deleted_at = ? WHERE id = ?")
    .run(ts, id);
  return true;
}

// ── Column ────────────────────────────────────────────────────

export function listColumns(boardId: string): KanbanColumn[] {
  const rows = db()
    .prepare(
      "SELECT * FROM kanban_columns WHERE board_id = ? AND deleted_at IS NULL ORDER BY position"
    )
    .all(boardId) as ColumnRow[];
  return rows.map(rowToColumn);
}

export function createColumn(data: {
  boardId: string;
  title: string;
  color?: string;
  position?: number;
  wipLimit?: number | null;
}): KanbanColumn {
  const id = uuid();
  const ts = now();
  const position = data.position ?? 0;

  inTransaction(() => {
    db()
      .prepare(
        `INSERT INTO kanban_columns (id, board_id, title, color, position, wip_limit, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id, data.boardId, data.title, data.color ?? "cyan", position,
        data.wipLimit ?? null, ts, ts
      );
    db()
      .prepare("UPDATE kanban_boards SET updated_at = ? WHERE id = ?")
      .run(ts, data.boardId);
  });

  return getColumn(id)!;
}

export function updateColumn(
  id: string,
  updates: { title?: string; color?: string; position?: number; wipLimit?: number | null }
): KanbanColumn | null {
  const existing = getColumn(id);
  if (!existing) return null;
  const ts = now();

  inTransaction(() => {
    const sets: string[] = ["updated_at = ?"];
    const vals: unknown[] = [ts];
    if (updates.title !== undefined) { sets.push("title = ?"); vals.push(updates.title); }
    if (updates.color !== undefined) { sets.push("color = ?"); vals.push(updates.color); }
    if (updates.position !== undefined) { sets.push("position = ?"); vals.push(updates.position); }
    if (updates.wipLimit !== undefined) { sets.push("wip_limit = ?"); vals.push(updates.wipLimit); }
    vals.push(id);
    db()
      .prepare(`UPDATE kanban_columns SET ${sets.join(", ")} WHERE id = ?`)
      .run(...vals);
    db()
      .prepare("UPDATE kanban_boards SET updated_at = ? WHERE id = ?")
      .run(ts, existing.boardId);
  });

  return getColumn(id);
}

export function deleteColumn(id: string): boolean {
  const existing = getColumn(id);
  if (!existing) return false;
  const ts = now();
  db()
    .prepare("UPDATE kanban_columns SET deleted_at = ? WHERE id = ?")
    .run(ts, id);
  db()
    .prepare("UPDATE kanban_boards SET updated_at = ? WHERE id = ?")
    .run(ts, existing.boardId);
  return true;
}

export function getColumn(id: string): KanbanColumn | null {
  const row = db()
    .prepare("SELECT * FROM kanban_columns WHERE id = ?")
    .get(id) as ColumnRow | undefined;
  return row ? rowToColumn(row) : null;
}

// ── Card ──────────────────────────────────────────────────────

export function listCards(boardId: string): KanbanCard[] {
  const rows = db()
    .prepare(
      "SELECT * FROM kanban_cards WHERE board_id = ? AND deleted_at IS NULL ORDER BY position"
    )
    .all(boardId) as CardRow[];
  return rows.map(rowToCard);
}

export function getCard(id: string): KanbanCard | null {
  const row = db()
    .prepare("SELECT * FROM kanban_cards WHERE id = ?")
    .get(id) as CardRow | undefined;
  return row ? rowToCard(row) : null;
}

export function createCard(data: {
  boardId: string;
  columnId: string;
  title: string;
  description?: string;
  assigneeProfileId?: string | null;
  labels?: string[];
  status?: KanbanCard["status"];
  position?: number;
}): KanbanCard {
  const id = uuid();
  const ts = now();
  const position = data.position ?? 0;
  // If no explicit status given, derive it from the destination column title
  // so a card created in "In Progress" column is immediately in_progress, not todo.
  const status = data.status
    ?? (data.columnId ? deriveStatusFromColumn(getColumn(data.columnId)?.title ?? "") : "todo");

  inTransaction(() => {
    db()
      .prepare(
        `INSERT INTO kanban_cards
           (id, board_id, column_id, title, description, position, status,
            assignee_profile_id, labels, mission_ids, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, '[]', ?, ?)`
      )
      .run(
        id, data.boardId, data.columnId, data.title,
        data.description ?? "", position, status,
        data.assigneeProfileId ?? null,
        JSON.stringify(data.labels ?? []),
        ts, ts
      );
    db()
      .prepare("UPDATE kanban_boards SET updated_at = ? WHERE id = ?")
      .run(ts, data.boardId);
  });

  return getCard(id)!;
}

export function updateCard(
  id: string,
  updates: {
    title?: string;
    description?: string;
    columnId?: string;
    position?: number;
    status?: KanbanCard["status"];
    assigneeProfileId?: string | null;
    labels?: string[];
    missionIds?: string[];
  }
): KanbanCard | null {
  const existing = getCard(id);
  if (!existing) return null;
  const ts = now();

  inTransaction(() => {
    const sets: string[] = ["updated_at = ?"];
    const vals: unknown[] = [ts];
    if (updates.title !== undefined) { sets.push("title = ?"); vals.push(updates.title); }
    if (updates.description !== undefined) { sets.push("description = ?"); vals.push(updates.description); }
    if (updates.columnId !== undefined) { sets.push("column_id = ?"); vals.push(updates.columnId); }
    if (updates.position !== undefined) { sets.push("position = ?"); vals.push(updates.position); }
    if (updates.status !== undefined) { sets.push("status = ?"); vals.push(updates.status); }
    if (updates.assigneeProfileId !== undefined) { sets.push("assignee_profile_id = ?"); vals.push(updates.assigneeProfileId); }
    if (updates.labels !== undefined) { sets.push("labels = ?"); vals.push(JSON.stringify(updates.labels)); }
    if (updates.missionIds !== undefined) { sets.push("mission_ids = ?"); vals.push(JSON.stringify(updates.missionIds)); }
    vals.push(id);
    db()
      .prepare(`UPDATE kanban_cards SET ${sets.join(", ")} WHERE id = ?`)
      .run(...vals);
    db()
      .prepare("UPDATE kanban_boards SET updated_at = ? WHERE id = ?")
      .run(ts, existing.boardId);
  });

  return getCard(id);
}

export function moveCard(
  cardId: string,
  toColumnId: string,
  toPosition: number
): KanbanCard | null {
  const card = getCard(cardId);
  if (!card) return null;

  // Derive status from destination column title so the UI gets the correct
  // status after a drag-drop. Column titles are user-configurable but we
  // recognise common naming conventions.
  const destColumn = getColumn(toColumnId);
  const status = destColumn ? deriveStatusFromColumn(destColumn.title) : undefined;

  return updateCard(cardId, {
    columnId: toColumnId,
    position: toPosition,
    ...(status ? { status } : {}),
  });
}

// ── Status derivation ──────────────────────────────────────────────

/** Maps a column title to a KanbanCardStatus. User-configurable via the UI. */
export function deriveStatusFromColumn(title: string): KanbanCard["status"] {
  const t = title.toLowerCase();
  const result = /\bin\s*progress\b/i.test(t) ? "in_progress"
    : /\breview\b|\bq[_\s]?a\b|\btesting\b/i.test(t) ? "review"
    : /\bdone\b|\bcompleted\b|\bclosed\b/i.test(t) ? "done"
    : /\bbacklog\b/i.test(t) ? "backlog"
    : /\btodo\b|\bto[_\s]?do\b|\bto\s*do\b/i.test(t) ? "todo"
    : /\bblocked\b/i.test(t) ? "blocked"
    : "todo";
  return result;
}

export function deleteCard(id: string): boolean {
  const existing = getCard(id);
  if (!existing) return false;
  const ts = now();
  db()
    .prepare("UPDATE kanban_cards SET deleted_at = ? WHERE id = ?")
    .run(ts, id);
  db()
    .prepare("UPDATE kanban_boards SET updated_at = ? WHERE id = ?")
    .run(ts, existing.boardId);
  return true;
}

// ── Full document loader ────────────────────────────────────────

export function loadKanbanDocument(boardId: string): KanbanDocument | null {
  const board = getBoard(boardId);
  if (!board) return null;

  const columns = listColumns(boardId);
  const cards = listCards(boardId);

  const columnsMap: Record<string, KanbanColumn> = {};
  const cardsMap: Record<string, KanbanCard> = {};

  for (const col of columns) {
    col.cardIds = cards.filter((c) => c.columnId === col.id).map((c) => c.id);
    columnsMap[col.id] = col;
  }
  for (const card of cards) {
    cardsMap[card.id] = card;
  }

  board.columnIds = Object.keys(columnsMap);

  return { board, columns: columnsMap, cards: cardsMap };
}

// ── Default board ──────────────────────────────────────────────

export function ensureDefaultBoard(): KanbanBoard {
  const existing = listBoards();
  if (existing.length > 0) return existing[0];

  const board = createBoard({ name: "My Board", description: "" });

  // Create default columns
  const columnDefs = [
    { title: "Backlog", color: "cyan", position: 0 },
    { title: "To Do", color: "orange", position: 1 },
    { title: "In Progress", color: "purple", position: 2 },
    { title: "Review", color: "pink", position: 3 },
    { title: "Done", color: "green", position: 4 },
  ];

  for (const def of columnDefs) {
    createColumn({ boardId: board.id, ...def });
  }

  return getBoard(board.id)!;
}

// ── Row mappers ────────────────────────────────────────────────

interface BoardRow {
  id: string; name: string; description: string;
  team_id: string | null; created_at: string; updated_at: string; deleted_at: string | null;
}
interface ColumnRow {
  id: string; board_id: string; title: string; color: string;
  position: number; wip_limit: number | null;
  created_at: string; updated_at: string; deleted_at: string | null;
}
interface CardRow {
  id: string; board_id: string; column_id: string; title: string; description: string;
  position: number; status: string; assignee_profile_id: string | null;
  labels: string; mission_ids: string; created_at: string; updated_at: string; deleted_at: string | null;
}

function rowToBoard(row: BoardRow): KanbanBoard {
  return {
    id: row.id, name: row.name, description: row.description,
    teamId: row.team_id ?? "",
    columnIds: [], // caller populates
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

function rowToColumn(row: ColumnRow): KanbanColumn {
  return {
    id: row.id, boardId: row.board_id, title: row.title, color: row.color as KanbanColumn["color"],
    position: row.position, wipLimit: row.wip_limit ?? null,
    cardIds: [], // caller populates
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

function rowToCard(row: CardRow): KanbanCard {
  return {
    id: row.id, boardId: row.board_id, columnId: row.column_id,
    title: row.title, description: row.description,
    position: row.position,
    status: row.status as KanbanCard["status"],
    assigneeProfileId: row.assignee_profile_id,
    labels: JSON.parse(row.labels || "[]"),
    missionIds: JSON.parse(row.mission_ids || "[]"),
    goalIndices: [],
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}
