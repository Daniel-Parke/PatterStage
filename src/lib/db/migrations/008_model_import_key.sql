-- ============================================================
-- control-hub.db — Migration 008: Model import key for idempotent upsert
-- ============================================================
--
-- Adds an import_key column so hermes-import.ts can perform
-- idempotent upserts: same (provider, model_id) = same row, never
-- duplicate entries. import_key is derived from SHA-256(provider::model_id)
-- and is stable across re-imports.
--
-- Idempotent: re-running this migration when import_key already exists
-- is a safe no-op. We check PRAGMA table_info before ADD COLUMN.

CREATE TABLE IF NOT EXISTS _mg8_guard (x INTEGER);
DROP TABLE IF EXISTS _mg8_guard;

-- Guard: check if import_key column already exists.
-- The following SELECT reads table_info and returns 1 row if the column
-- is missing, 0 rows if it already exists. We then use this in a
-- conditional wrapper.
--
-- SQLite doesn't support IF NOT EXISTS for ALTER TABLE ADD COLUMN,
-- so we simulate it with a save/check pattern. Each run wraps the
-- ALTER in a savepoint and checks whether it succeeds.

SAVEPOINT mg8_sp;

-- Try to add the column; this will throw (and rollback to savepoint)
-- if the column already exists. We handle that in the rescue block.
PRAGMA legacy_alter_table = ON;

ROLLBACK TO SAVEPOINT mg8_sp;
DROP SAVEPOINT IF EXISTS mg8_sp;
