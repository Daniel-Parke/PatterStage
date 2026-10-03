# ═══════════════════════════════════════════════════════════════
# Combined PatterStage + Hermes image (BD4)
#
# The standard 3-container real-Hermes stack runs Hermes as a SEPARATE
# container, so PatterStage can't spawn per-profile gateways there (no hermes
# binary reachable). This image co-locates CH with the Hermes binary so the
# benchmark gateway manager (src/lib/runtime/gateway-manager.ts) can be driven
# end-to-end: CH spawns an ephemeral `hermes gateway` per bench profile and an
# agentic run actually exercises the toggled config.
#
# Built ON the official Hermes image (Debian 13 + Node 22 + the hermes venv) so
# the better-sqlite3 native ABI matches the runtime node — no cross-node copy.
# ═══════════════════════════════════════════════════════════════
ARG HERMES_IMAGE=nousresearch/hermes-agent@sha256:47d80115ce62603fa0cab8af2b8d1816c5e800fbae851f7e66608435cfbb76f7

# ── Build PatterStage with the image's own Node 22 ──────────────
FROM ${HERMES_IMAGE} AS builder
USER root
WORKDIR /build
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
RUN mkdir -p public \
  && NEXT_TELEMETRY_DISABLED=1 NODE_OPTIONS=--max-old-space-size=4096 npm run build

# ── Final: Hermes image + the built CH app ──────────────────────
FROM ${HERMES_IMAGE} AS runner
USER root
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=42069 \
    HOSTNAME=0.0.0.0 \
    PS_DATA_DIR=/data/ch \
    HERMES_HOME=/data/hermes \
    HERMES_BIN=/opt/hermes/.venv/bin/hermes

COPY --from=builder /build/public ./public
COPY --from=builder /build/.next ./.next
COPY --from=builder /build/node_modules ./node_modules
COPY --from=builder /build/package.json ./
COPY --from=builder /build/scripts ./scripts
# Runtime-read SQL + seed data (cwd-relative; see resolveMigrationsDir / boot seed).
COPY --from=builder /build/src/lib/db ./src/lib/db
COPY --from=builder /build/data/seed ./data/seed

# mock-llm-pointing Hermes config for CH's HERMES_HOME, so the gateways CH
# spawns inherit a working LLM provider + API-server key.
COPY test-harness/hermes-home/ /seed-hermes/
COPY test-harness/bench-gateway-entrypoint.sh /usr/local/bin/ch-bench-entry.sh
RUN chmod +x /usr/local/bin/ch-bench-entry.sh

EXPOSE 42069
HEALTHCHECK --interval=10s --timeout=5s --start-period=45s --retries=12 \
  CMD node -e "require('http').get('http://127.0.0.1:'+(process.env.PORT||42069),(r)=>process.exit(r.statusCode&&r.statusCode<500?0:1)).on('error',()=>process.exit(1))"

# Override the Hermes s6 entrypoint: we don't want the supervised default
# gateway — CH spawns its own bench gateways on demand.
ENTRYPOINT ["/usr/local/bin/ch-bench-entry.sh"]
