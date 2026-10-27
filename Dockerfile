# syntax=docker/dockerfile:1
#
# AfriScore API image.
#
# Multi-stage build: TypeScript is compiled in the builder, and only the
# runtime dist/ output plus production dependencies are copied into the final
# image. `better-sqlite3` is a native module, so the build stages install a
# small C/C++ toolchain; the final image also needs it present at runtime only
# if npm had to compile rather than fetch a prebuilt binary, which is why the
# production dependency tree is installed in its own stage and copied.
#
# Build:  docker build -t afriscore-api .
# Run:    docker run --rm -p 4000:4000 \
#           -e DATABASE_URL=postgres://... \
#           -e AFRISCORE_ADMIN_TOKEN=... -e ID_HASH_SALT=... -e LEDGER_HMAC_KEY=... \
#           -e AFRISCORE_WEBHOOK_ALLOWED_HOSTS=hooks.partner.example \
#           afriscore-api
# NODE_ENV=production is set below, so the API refuses to start unless the
# required secrets are present (see src/index.ts / .env.example).

FROM node:22-bookworm-slim AS base
WORKDIR /app
ENV NPM_CONFIG_UPDATE_NOTIFIER=false \
    NPM_CONFIG_FUND=false

RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ \
 && rm -rf /var/lib/apt/lists/*

# --- Build stage: full dependency tree + TypeScript compile -----------------
FROM base AS build

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY scripts/clean-build.cjs ./scripts/clean-build.cjs
COPY src ./src
RUN npm run build

FROM base AS website-build
WORKDIR /app/website
COPY website/package.json website/package-lock.json ./
RUN npm ci
COPY website ./
COPY dashboard/shared /app/dashboard/shared
RUN npm run build

# --- Production dependencies only ------------------------------------------
FROM base AS production-deps

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# --- Runtime ---------------------------------------------------------------
FROM node:22-bookworm-slim AS runtime

WORKDIR /app
ENV NODE_ENV=production \
    PORT=4000 \
    DB_PATH=/app/data/afriscore.db

COPY package.json platform-openapi.json ./
COPY dashboard ./dashboard
COPY docs ./docs
COPY --from=website-build /app/website/dist ./website/dist
COPY --from=production-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist

# The official Node images ship an unprivileged `node` user (uid 1000).
# /app/data is the writable location for the optional SQLite database; a
# production deployment should use PostgreSQL via DATABASE_URL instead.
RUN mkdir -p /app/data && chown -R node:node /app

USER node
EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:' + (process.env.PORT || 4000) + '/v1/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"]

CMD ["node", "dist/index.js"]
