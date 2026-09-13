-- ============================================================
-- 042_fallback_identity.sql — a custom fallback entry keeps its identity
--
-- T-0140. `model_fallbacks` carried only the registry FK, and a custom entry
-- (one typed on the Models page, not chosen from the registry) has none. The
-- INSERT dropped its name, provider and model id on the floor; the reads
-- joined `models` for them and found nothing, so every list after the add
-- said Custom / custom / an empty model id, and that empty id is what the
-- chain then pushed into config.yaml. Three columns, written for a custom
-- entry and read where the JOIN has nothing.
--
-- No backfill: a row written before this file has nothing to backfill from,
-- and keeps reading as Custom. The same shape as 041: ALTERs only, so the
-- file is safe to re-run and the applier's version gate is a performance
-- guard rather than a correctness one.
-- ============================================================

ALTER TABLE model_fallbacks ADD COLUMN custom_name TEXT;
ALTER TABLE model_fallbacks ADD COLUMN custom_provider TEXT;
ALTER TABLE model_fallbacks ADD COLUMN custom_model_id TEXT;
