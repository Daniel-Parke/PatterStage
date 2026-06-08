#!/usr/bin/env bash
# Smoke-test POST /api/update { action: restart } against the production Docker image.
# Requires Docker (Linux CI, Docker Desktop, or WSL). Does not run git pull / rebuild.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

IMAGE="${CH_DOCKER_TEST_IMAGE:-control-hub:api-smoke}"
NAME="${CH_DOCKER_TEST_NAME:-ch-api-smoke-$$}"
HOST_PORT="${CH_DOCKER_TEST_PORT:-42090}"

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
  -e CH_ENABLE_DEPLOY_API=true \
  "$IMAGE"

ready=0
for _ in $(seq 1 60); do
  if curl -sf -o /dev/null "http://127.0.0.1:${HOST_PORT}/"; then
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

curl -sf "http://127.0.0.1:${HOST_PORT}/api/update?branch=dev" | grep -q '"data"' || {
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
# image small), so ch-deploy.sh's git-aware paths can't actually succeed
# in this image. The original smoke test only "worked" because the API
# used to return 200 {status:"started"} without ever verifying the script
# ran. The new probe correctly rejects that case. The contract we test
# here is the API's probe behavior, not the deploy script's end-to-end
# success (which is covered by the in-repo integration tests on dev).
http_code="$(curl -s -o /tmp/ch-api-smoke-resp.$$.body -w '%{http_code}' \
  -X POST "http://127.0.0.1:${HOST_PORT}/api/update" \
  -H "Content-Type: application/json" \
  -d '{"action":"restart"}' || true)"
resp="$(cat /tmp/ch-api-smoke-resp.$$.body 2>/dev/null || echo '')"
rm -f /tmp/ch-api-smoke-resp.$$.body

case "$http_code" in
  200)
    echo "$resp" | grep -q '"started"' || {
      echo "ERROR: POST restart 200 but no 'started' marker: $resp" >&2
      exit 1
    }
    # 200 means the script is still alive past the probe window. The
    # script will (try to) kill the container's own server and respawn
    # it. Wait briefly and confirm the server is still responsive.
    sleep 12
    curl -sf -o /dev/null "http://127.0.0.1:${HOST_PORT}/" || {
      echo "ERROR: server not responding after restart" >&2
      docker logs "$NAME" 2>&1 | tail -80 >&2 || true
      exit 1
    }
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
