# PatterStage — production image (Next.js)
FROM node:20-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json* ./
RUN npm ci

FROM node:20-bookworm-slim AS builder
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Next.js expects `public/`; repo may ship only static assets later — dir must exist for runner COPY.
RUN mkdir -p public
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_OPTIONS=--max-old-space-size=4096
RUN npm run build

FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Runtime tools for scripts/application/ps-deploy.sh (same entrypoint as POST /api/update).
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    bash \
    ca-certificates \
    curl \
    git \
    iproute2 \
    psmisc \
    socat \
  && rm -rf /var/lib/apt/lists/*

RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/scripts ./scripts
# Migration + seed SQL is read at runtime via a cwd-relative path (see
# resolveMigrationsDir in src/lib/db/index.ts); the Next bundle does not co-locate
# these next to __dirname, so copy the source SQL explicitly.
COPY --from=builder /app/src/lib/db ./src/lib/db
# Seed catalog data (profiles, skills, tools, memories, template packs) is read
# at runtime by the one-time boot seed (ensureCatalogSeededOnce) — without it a
# fresh deploy can't seed the benchmark catalog. cwd-relative, like the SQL above.
COPY --from=builder /app/data/seed ./data/seed

RUN chown -R nextjs:nodejs /app/scripts

# Ensure $HOME is set AND the directory exists for nextjs (UID 1001).
# The nextjs user is created via adduser --system, which leaves the
# passwd entry pointing at /nonexistent with no home directory. Without
# this, $HOME=/home/nextjs is set but the path doesn't exist, and the
# nextjs user has no permission to mkdir their own parent — so
# `mkdir -p $HOME/.hermes/logs` in ps-deploy.sh dies with EACCES.
# WORKDIR alone is not enough: it only creates /app (which already
# exists). Discovered 2026-06-08: the post-spawn liveness probe in
# /api/update surfaced this bug; the previous dev branch's smoke
# test passed only because the API silently returned 200
# {status:"started"} without ever verifying the script actually ran.
RUN mkdir -p /home/nextjs && chown nextjs:nodejs /home/nextjs
# Data mount points must be writable by the non-root nextjs user. Creating +
# chowning them here means fresh named volumes mounted at /data/ch and
# /data/hermes inherit nextjs ownership (Docker seeds empty volumes from the
# image path), so SQLite can create patterstage.db. Without this the container
# fails with "unable to open database file".
RUN mkdir -p /data/ch /data/hermes && chown -R nextjs:nodejs /data
ENV HOME=/home/nextjs
# WORKDIR is also required so `npm run start:network` (CMD) runs from
# /app where package.json lives — otherwise the nextjs user's $HOME
# becomes the implicit workdir and npm can't find package.json.
WORKDIR /app
USER nextjs
EXPOSE 42069
ENV HOSTNAME=0.0.0.0
ENV PORT=42069
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:'+(process.env.PORT||42069),(r)=>process.exit(r.statusCode&&r.statusCode<500?0:1)).on('error',()=>process.exit(1))"
CMD ["npm", "run", "start:network"]
