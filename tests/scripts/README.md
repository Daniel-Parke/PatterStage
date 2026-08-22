---
summary: The bash integration checks for the install and deploy helpers, and how to run them
type: guide
tags: [testing]
compiled_from: normalised
---

# Shell integration tests (Hermes profile helpers)

Bash checks for install/deploy helpers—fake `HERMES_HOME` under `/tmp`, so your real `~/.hermes` is untouched. I run these in CI on every push.

```bash
# From repo root (Linux / macOS / WSL / Git Bash), or:
docker run --rm -v "$(pwd)":/work -w /work bash:5 bash tests/scripts/run-shell-custom-tests.sh
```

Exit code **0** = all checks passed.

Profile templates are validated via `ch-hermes-profile-templates.sh` (install-only). **`ch-deploy update`** runs `seed-catalog.ts --merge` instead of the legacy `CH_UPDATE_SYNC_*` gate.

## Docker — dashboard restart smoke

From repo root on a machine with Docker (Linux CI, Docker Desktop, WSL):

```bash
docker build -f Dockerfile -t patterstage:ci .
PS_DOCKER_TEST_IMAGE=patterstage:ci bash tests/scripts/docker-deploy-api-smoke.sh
```

Builds the image if missing, runs a container, hits **`GET /api/update?branch=dev`** and **`POST /api/update` `{ action: restart }`**, then verifies **`/`** still responds. Does **not** run `git pull` / rebuild (no `.git` in the default image).
