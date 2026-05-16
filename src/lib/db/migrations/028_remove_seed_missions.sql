-- 028_remove_seed_missions.sql
-- Remove seed/demo mission data that pollutes the Mission Board
-- as "queued" missions. Soft-delete so users see a clean board.
-- Migration 002_seed_data.sql inserted these as demo rows.

UPDATE missions
SET deleted_at = datetime('now')
WHERE id IN ('seed-mission-research', 'seed-mission-code-review', 'seed-mission-content')
  AND deleted_at IS NULL;
