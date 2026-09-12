-- 011_drop_game_tables.sql
--
-- Gamification dial-back. The heavy RPG/Gacha layer (Arcade, currency, gacha,
-- collectible Unit Cards, arena) was removed. The kept RPG-lite progression
-- (level / streak / achievements) is derived live from real activity in the
-- stats layer, so there is no game state to persist. Drop the tables the
-- removed 010_game_tables migration created.
--
-- Idempotent: DROP ... IF EXISTS is a no-op on fresh installs that never
-- created them (the 010 migration + its applier were deleted in the same change).
DROP TABLE IF EXISTS game_events;
DROP TABLE IF EXISTS game_quests;
DROP TABLE IF EXISTS game_unlocks;
DROP TABLE IF EXISTS game_inventory;
DROP TABLE IF EXISTS game_agent;
DROP TABLE IF EXISTS game_player;
