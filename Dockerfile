# syntax=docker/dockerfile:1

# --- Dependencies stage: install node_modules with pnpm ---
FROM node:20-bookworm-slim AS deps
WORKDIR /app

# Enable corepack to get pnpm from lockfile / packageManager if present
RUN corepack enable

# Copy only manifests to leverage Docker layer caching
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# Also copy workspace package manifests
COPY packages/api/package.json ./packages/api/package.json
COPY packages/sdk/package.json ./packages/sdk/package.json

# Install deps (respects pnpm-lock.yaml)
# Skip lifecycle scripts here because schema files are not yet copied
# Use --no-frozen-lockfile to tolerate lockfile drift in CI builds; switch back once lockfile is updated
RUN pnpm install --frozen-lockfile --ignore-scripts

# --- Builder stage: build Next.js app ---
FROM node:20-bookworm-slim AS builder
WORKDIR /app
RUN corepack enable \
    && apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Reuse previously installed node_modules
COPY --from=deps /app/node_modules ./node_modules
# Copy the full workspace
COPY . .

# Accept version and build metadata as build arguments
ARG APP_VERSION=0.0.0-unknown
ARG VCS_REF=unknown

RUN set -eu; \
    mkdir -p public; \
    printf "%s" "$APP_VERSION" | tee public/version.txt

# Store version for runtime use
ENV NEXT_PUBLIC_APP_VERSION="$APP_VERSION"

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Generate Prisma client before building
RUN pnpm prisma:generate

# Build Next.js (standalone server output)
RUN pnpm build

# --- Runner stage: minimal runtime image ---
FROM node:20-bookworm-slim AS runner
WORKDIR /app

# Install OpenSSL runtime needed by Prisma engine
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Accept version and build metadata as build arguments
ARG APP_VERSION=0.0.0-unknown
ARG VCS_REF=unknown

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV NEXT_PUBLIC_APP_VERSION="$APP_VERSION"
ENV PROMPTBRIDGE_VERSION="$APP_VERSION"

# OCI image labels
LABEL org.opencontainers.image.version="$APP_VERSION" \
      org.opencontainers.image.revision="$VCS_REF"

# Copy the standalone server and static files from the builder
# .next/standalone contains server.js and a pruned node_modules
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Static assets (including version.txt)
COPY --from=builder /app/public ./public

# Ensure Next.js cache dir is writable by the node user
RUN mkdir -p /app/.next/cache && chown -R node:node /app/.next

# Use the non-root node user provided by the base image
USER node

EXPOSE 3000
CMD ["node", "server.js"]
