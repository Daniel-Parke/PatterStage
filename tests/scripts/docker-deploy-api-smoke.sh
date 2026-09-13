#!/usr/bin/env bash
# Smoke-test POST /api/update { action: restart } against the production Docker image.
# Requires Docker (Linux CI, Docker Desktop, or WSL). Does not run git pull / rebuild.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

IMAGE="${PS_DOCKER_TEST_IMAGE:-patterstage:api-smoke}"
NAME="${PS_DOCKER_TEST_NAME:-ps-api-smoke-$$}"
HOST_PORT="${PS_DOCKER_TEST_PORT:-42090}"

if ! docker image inspect "$IMAGE" >/dev/null 2>&1; then
  docker build -f Dockerfile -t "$IMAGE" "$ROOT"
fi

cleanup() {
  docker rm -f "$NAME" >/dev/null 2>&1 || true
}
trap cleanup EXIT

docker run -d --name "$NAME" \
  -p "${HOST_PORT}:42069" \
  -e PORT=42069 \
  -e NODE_ENV=production \
  -e PS_ENABLE_DEPLOY_API=true \
  "$IMAGE"

# Since the auth boundary (src/proxy.ts), /api/health is the ONE public path;
# every other path 401s without a token, and curl -f treats 401 as failure —
# probing "/" here would therefore never report ready even with the app up.
ready=0
for _ in $(seq 1 60); do
  if curl -sf -o /dev/null "http://127.0.0.1:${HOST_PORT}/api/health"; then
    ready=1
    break
  fi
  sleep 2
done
if [ "$ready" -ne 1 ]; then
  echo "ERROR: app did not become ready in time" >&2
  docker logs "$NAME" 2>&1 | tail -80 >&2 || true
  exit 1
fi

# Boot instrumentation (src/instrumentation.ts) mints the token file BEFORE any
# request is served, so once /api/health answers, a single read is race-free.
# Path = $HOME (/home/nextjs, set in the Dockerfile) + the PS_DATA_DIR default
# (src/lib/paths.ts) + /auth-token (src/lib/auth-token.ts). Wrapped in `sh -c`
# so Git Bash on Windows does not rewrite the absolute path (MSYS mangling).
TOKEN="$(docker exec "$NAME" sh -c 'cat /home/nextjs/patterstage/data/auth-token' 2>/dev/null | tr -d '[:space:]' || true)"
if [ -z "$TOKEN" ]; then
  echo "ERROR: could not read auth token from container" >&2
  docker logs "$NAME" 2>&1 | tail -80 >&2 || true
  exit 1
fi

curl -sf -H "Authorization: Bearer ${TOKEN}" \
  "http://127.0.0.1:${HOST_PORT}/api/update?branch=dev" | grep -q '"data"' || {
  echo "ERROR: GET /api/update?branch=dev unexpected body" >&2
  exit 1
}

resp_code=0
resp=""

# Probe-based behavior (post-2026-06-08 fix): the API now returns 500 fast
# when the spawn dies (lock held, $HOME missing, etc.) instead of the
# optimistic 200 {status:"started"} that the old code returned. Accept
# either a clean 200 OR a 500 with a known diagnostic — both prove the
# spawn probe is working.
#
# Why we don't wait + re-probe the server: the Docker image does NOT ship
# the .git directory (it's stripped from the runner stage to keep the
# image small), so ps-deploy.sh's git-aware paths can't actually succeed
# in this image. The original smoke test only "worked" because the API
# used to return 200 {status:"started"} without ever verifying the script
# ran. The new probe correctly rejects that case. The contract we test
# here is the API's probe behavior, not the deploy script's end-to-end
# success (which is covered by the in-repo integration tests on dev).
http_code="$(curl -s -o /tmp/ps-api-smoke-resp.$$.body -w '%{http_code}' \
  -X POST "http://127.0.0.1:${HOST_PORT}/api/update" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"action":"restart"}' || true)"
resp="$(cat /tmp/ps-api-smoke-resp.$$.body 2>/dev/null || echo '')"
rm -f /tmp/ps-api-smoke-resp.$$.body

case "$http_code" in
  200)
    echo "$resp" | grep -q '"started"' || {
      echo "ERROR: POST restart 200 but no 'started' marker: $resp" >&2
      exit 1
    }
    # 200 {started} = the API accepted the restart, the deploy runner (ps-deploy.mjs)
    # outlived the liveness probe, and — crucially — the HTTP response FLUSHED
    # before the runner tore down the listener (the grace delay in restartBody).
    # We deliberately do NOT then require the server to self-resurrect: this
    # image's CMD is `npm run start:network`, so next-server is PID 1's only
    # child; killing its port ends PID 1 and stops the container. On a real host
    # the server runs detached and ps-deploy.mjs respawns it on the same port —
    # that end-to-end respawn is covered by the host integration tests, not here.
    echo "OK: POST restart returned 200 {started} (spawn survived probe + response flushed)"
    ;;
  500)
    # 500 is the new fail-loud signal. It must be a known diagnostic
    # (the spawn probe caught a real failure), not an unhandled error.
    echo "$resp" | grep -Eq '"error":[[:space:]]*"(Deploy already in progress|Deploy script exited immediately|Docker CLI failed|Docker not found in PATH)' || {
      echo "ERROR: POST restart 500 with unknown error body: $resp" >&2
      exit 1
    }
    echo "OK: POST restart returned 500 (spawn probe working). resp=$resp"
    ;;
  *)
    echo "ERROR: POST restart unexpected HTTP $http_code: $resp" >&2
    exit 1
    ;;
esac

echo "OK: docker deploy-api restart smoke passed"
