---
summary: The bash integration checks for the install and deploy helpers, and how to run them
type: guide
tags: [testing]
compiled_from: normalised
---

# Shell integration tests (Hermes profile helpers)

Bash checks for install/deploy helpers—fake `HERMES_HOME` under `/tmp`, so your real `~/.hermes` is untouched. I run these in CI on every push.

```bash
# From repo root (Linux / macOS / WSL):
bash tests/scripts/run-shell-custom-tests.sh
```

Exit code **0** = all checks passed.

The harness needs `bash`, `jq`, `python3` and `node` on PATH. A plain `bash:5` container has none of the last three, so if you want to run it in Docker, use a base image that has them (CI runs it on `ubuntu-latest`, which does).

Profile templates are validated via `scripts/lib/ps-hermes-profile-templates.sh` (install-only). **`ps-deploy update`** runs `seed-catalog.ts --merge` instead of the legacy `CH_UPDATE_SYNC_*` gate.

## PORT and the `.env.local` writers

The interactive port prompt runs inside `$( )`, so whatever it prints to stdout *is* the value the caller stores. When the prompt banner went to stdout, a clean bootstrap wrote four lines of prose into `.env.local` as `PORT=`, and every reader then saw an empty port. The old de-dup could not remove the orphan lines it had just written, so the corruption survived each re-run and had to be edited out by hand.

These checks drive `ps_setup_port_and_dev_origins` down its interactive branch with piped input and assert `.env.local` ends up with a bare numeric `PORT` and no orphan lines. They also push a deliberately polluted capture past the prompt, so the `ps_validate_port_number` guard is proved on its own rather than only alongside the stderr fix, and they hand an already-corrupted file to `ps_env_set` to prove it now cleans up. The same two rules are checked on the Node side against `scripts/bootstrap/env-local.mjs`, which is where `setup.mjs` keeps its writer.

## Docker — dashboard restart smoke

From repo root on a machine with Docker (Linux CI, Docker Desktop, WSL):

```bash
docker build -f Dockerfile -t patterstage:ci .
PS_DOCKER_TEST_IMAGE=patterstage:ci bash tests/scripts/docker-deploy-api-smoke.sh
```

Builds the image if missing, runs a container, hits **`GET /api/update?branch=dev`** and **`POST /api/update` `{ action: restart }`**, then verifies **`/`** still responds. Does **not** run `git pull` / rebuild (no `.git` in the default image).
