# Hermes toolsets and missions

## Runtime tools (Hermes)

Hermes controls which tools are available per platform via `platform_toolsets` in each profile's `config.yaml`. See [Hermes configuration — platform toolsets](https://hermes-agent.nousresearch.com/docs/user-guide/configuration).

PatterStage stores toolsets in SQLite (`agent_profiles.platform_toolsets`, `agent_root.platform_toolsets`) and mirrors them to disk on **push**.

| Surface | Action |
|---------|--------|
| **Operations → Tools** | One **enabled toolsets** grid per profile (fans out to all gateways on save — same idea as `hermes tools` → configure all platforms). Optional **advanced per-platform** overrides and JSON. **Save & push** writes SQLite and `config.yaml`. |
| **Pull from Hermes** | Import disk `config.yaml` into SQLite (normalizes duplicates / `hermes-cli` expansion). |
| **Push to Hermes** | Write assembled config from SQLite to `HERMES_HOME` or `profiles/<slug>/`. |
| **Operations → Agents** | Push/pull all profile content (includes toolsets in full `config.yaml`). Push Bob re-applies Models registry defaults to root `config.yaml`. |

`/api/tools` (GET) returns a read-only catalog of known toolset IDs; POST is not supported.

## Missions — recommended toolsets

Missions can include **recommended toolsets** in the assembled prompt (`<recommended_toolsets>`), same pattern as **recommended skills**:

- Stored in `missions.suggested_toolsets` (JSON array).
- **Not enforced** at dispatch — `hermes chat` still uses the profile's `platform_toolsets`.
- Mission composer **ToolsetSelector** only lists toolsets enabled on the selected profile.

## Operator bootstrap

```bash
npm run db:migrate
npx tsx scripts/tooling/import-hermes-state.ts   # when ~/.hermes exists
npm run db:seed
```

Then open **Operations → Tools**, select each profile, **Pull from Hermes** if you edited toolsets with `hermes tools`, or confirm seeded toolsets appear. **Save & push** when editing in PatterStage.

Schema version after this release: **3** (`002_profiles_tools_parity.sql` on upgrade; squashed `001_baseline.sql` on fresh install).
