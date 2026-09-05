# Professional catalog seeds (shipped with PatterStage)

Source files for the catalog that `seed-catalog.ts` loads into SQLite. This directory is **version-controlled**; your live database lives under `PS_DATA_DIR` (typically `~/patterstage/data`), not here.

| Path | Purpose |
|------|---------|
| `agent-root/` | Bob, the default local Hermes agent (`SOUL.md`, `AGENTS.md`, `HERMES.md`, memories, `config.yaml`) |
| `profiles/manifest.json` | Seven professional agent profiles |
| `profiles/<slug>/` | `SOUL.md`, `AGENTS.md`, `config.yaml` per profile |
| `template-packs/patterstage-professional-v1.json` | Mission templates for the composer |

## Apply seeds

```bash
npm run db:migrate
npx tsx scripts/tooling/import-hermes-state.ts   # import existing ~/.hermes first when present
npm run db:seed          # merge (skip existing seeded rows)
npm run db:seed -- --replace   # via: npx tsx scripts/tooling/seed-catalog.ts --replace
```

Or use **Settings → Restore** in the UI (`/agent/settings/restore`), which counts what this directory ships and backs the database up before any overwrite.

Seed configs use Hermes-native `skills.disabled` and `platform_toolsets`. Default seeds enable the full PatterStage tool catalog on every gateway (`data/seed/shared/full-toolset-ids.json`; regenerate with `node scripts/tooling/render-seed-platform-toolsets.mjs`). Seeds do not set `model.default`; model policy is inherited from the live Hermes/PatterStage model registry.

Mission templates in `template-packs/` may include optional `suggestedToolsets` (prompt hints only; runtime tools still come from the mission profile's `platform_toolsets`). Merge seed backfills empty profile toolsets and empty template `suggestedToolsets` from the pack.

## Validate or scaffold seed pack

```bash
node scripts/tooling/generate-seed-pack.mjs
```

Use this to validate `manifest.json` / template pack JSON or scaffold new seed files—not to regenerate from removed legacy `bundled-profiles/` trees.
