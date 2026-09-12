-- ============================================================
-- 039_models_origin.sql — tell an imported model from an operator's own
--
-- Editing a model's name or base URL was undone by the next import: the
-- import matches on (provider, model_id) and overwrote both columns with
-- whatever config.yaml said, so a rename survived until the page reloaded
-- (T-0100, D10). `origin` says where a row came from, and the last-imported
-- pair remembers what the import last wrote, so the repository can tell an
-- operator's edit from a value the import itself put there.
--
-- Runs exactly once, behind the applier's version gate: this file is one
-- exec(), so a re-run against a database that already has the columns would
-- stop at the first duplicate-column error and skip the backfill below.
-- ============================================================

ALTER TABLE models ADD COLUMN origin TEXT NOT NULL DEFAULT 'user' CHECK (origin IN ('import', 'user'));
ALTER TABLE models ADD COLUMN last_imported_name TEXT;
ALTER TABLE models ADD COLUMN last_imported_base_url TEXT;

-- Classify what is already there. Two signals, because the two importers
-- leave different traces: the prebuild script writes `import_key`, while
-- POST /api/models/import leaves it NULL and names the row after its model
-- id. A row the operator named after its own id is classified as imported
-- and its name tracks the import only until they rename it, which is the
-- benign direction to be wrong in.
UPDATE models
   SET origin = 'import',
       last_imported_name = name,
       last_imported_base_url = base_url
 WHERE import_key IS NOT NULL OR name = model_id;
