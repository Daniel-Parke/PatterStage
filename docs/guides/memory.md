---
title: Memory
summary: The Memory page and the Hindsight provider behind it, and how the agent's long-term memory is browsed
section: guides
nav: 140
audience: operator
screen: /agent/memory
concepts: [memory]
type: guide
tags: [product, memory]
compiled_from: normalised
---
# Memory (Hindsight)

PatterStage's **Memory** page is a browser over your agent's long-term memory. The supported provider is **Hindsight**, a knowledge-graph memory server (Postgres + pgvector) that stores *memories*, *directives*, and *mental models*, and answers semantic queries. This is how the agent grows over time: facts it learns persist and resurface on later runs.

## How it connects

- Hindsight runs as an HTTP server, by default on **`127.0.0.1:9177`**.
- PatterStage talks to it directly from [`/api/memory/hindsight`](../../src/app/api/memory/hindsight/route.ts) (no Python subprocess): list/recall/reflect, plus CRUD for directives + mental models. Pure response mapping lives in [`hindsight-bridge.ts`](../../src/lib/memory/hindsight-bridge.ts).
- **PatterStage's own database owns the connection, not a config file.** The active provider and the host, port and bank used to reach it live in the `memory_providers` table (migration `022`), read by [`getActiveMemoryConfig()`](../../src/lib/memory/memory-providers/repository.ts) and turned into a live provider by [`registry.ts`](../../src/lib/memory/memory-providers/registry.ts). Edit them in the **provider panel at the top of the Memory page** (backed by `GET`/`PUT /api/memory/config`, which also offers a Test connection probe): changing the endpoint needs no file edits, which is the point of the table. With nothing reachable, the Memory page degrades gracefully.
- **The agent's `config.yaml` is written, not consulted.** `PUT /api/memory/config` sets `memory.provider` in the file whenever it makes a provider active, so the agent's own copy agrees with the database. Nothing in PatterStage reads it back to decide anything: `getMemoryProviderType()` answers from `getActiveMemoryConfig()`, the same resolver the live provider comes from. It used to hand-scan the file instead, which meant a blank or malformed `config.yaml` reported "no memory" over a live store with thousands of facts, and the Settings page and the Memory page were two switches reading two truths (T-0101). A file that will not parse is reported on the save, not overwritten.
- **The Settings > Memory `Provider` field is a read-only pointer.** It shows what is active and links to the Memory page, which is the one place that changes it.

## Running Hindsight

Three options, from lightest to production:

### 1. Mock (any OS, zero deps): for development + tests

```bash
npm run mock-hindsight       # in-memory server on :9177 (seeded with sample data)
```

[`mock-hindsight/server.mjs`](../../mock-hindsight/server.mjs) implements the same HTTP contract as the real server, so the Memory page and the `/api/memory/hindsight` route work without Postgres, Python, or an LLM. State is in-memory (lost on restart). The route handlers are covered against this contract in [`hindsight-route.test.ts`](../../tests/unit/hindsight-route.test.ts). Set `HINDSIGHT_SEED=0` to start empty, `HINDSIGHT_PORT` to change the port.

### 2. Docker (Linux · macOS · Windows): a real Hindsight, cross-platform

```bash
bash scripts/bootstrap/setup-hindsight.sh --docker
# or directly:
docker compose -f scripts/bootstrap/docker-compose.hindsight.yml up -d --build
curl http://localhost:9177/health
```

This brings up **Postgres + pgvector** and the **Hindsight API** ([`hindsight-docker/`](../../scripts/bootstrap/hindsight-docker)) in containers. No host Postgres, Python, or Hermes venv required. The server reaches the Hermes gateway on the host (for embeddings) via `host.docker.internal:8642`. Override the LLM with `HINDSIGHT_LLM_BASE_URL`, `HINDSIGHT_LLM_MODEL`, `HINDSIGHT_LLM_API_KEY` (e.g. point at a local model or a cloud provider). The `--docker` flow also sets `memory.provider: hindsight` in your config.

### 3. Native (Linux): apt + systemd

```bash
bash scripts/bootstrap/setup-hindsight.sh
```

Installs Postgres + pgvector via apt, `pip install hindsight-all` into the Hermes agent venv, and runs the server as a systemd service ([`hindsight-server.py`](../../scripts/bootstrap/hindsight-server.py)). Connection details are env-overridable (`HINDSIGHT_DB_URL`, `HINDSIGHT_LLM_BASE_URL`, `HINDSIGHT_LLM_MODEL`, `HINDSIGHT_PORT`). `--wire-only` re-wires config against an already-running server.

The installer ([`install.sh`](../../scripts/bootstrap/install.sh)) offers all of this: **Docker** (recommended on macOS/Windows) or **Native** (Linux). Non-interactive: `INSTALL_HINDSIGHT=docker|yes|no`.

## Banks

Memories live in **banks**. The default is whatever the active provider row carries (`hermes` out of the box), and every route accepts an optional `bank` parameter to override it for one request.
