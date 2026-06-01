-- Add message_count column to sessions so the Sessions list can show
-- a "5 msgs" badge per row and users can tell populated sessions from
-- empty ones without clicking through.
--
-- Populated by the Hermes state.db sync (readHermesSessionsFromStateDb ->
-- syncHermesSessionsToDb) from the sessions.message_count column in
-- ~/.hermes/state.db. Null for sessions written directly by the Control
-- Hub dispatch pipeline (mission/cron rows) where the count is only
-- known after the agent finishes — the next sync tick will fill them in.
--
-- Idempotent: only applies if the column does not yet exist.
PRAGMA if_null((SELECT 0 FROM pragma_table_info('sessions') WHERE name='message_count'), 1);
ALTER TABLE sessions ADD COLUMN message_count INTEGER;
