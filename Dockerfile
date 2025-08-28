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
RUN pnpm install --frozen-lockfile --ignore-scripts

# --- Builder stage: build Next.js app ---
FROM node:20-bookworm-slim AS builder
WORKDIR /app
RUN corepack enable

# Reuse previously installed node_modules
COPY --from=deps /app/node_modules ./node_modules
# Copy the full workspace
COPY . .

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Generate Prisma client before building
RUN pnpm prisma:generate

# Build Next.js (standalone server output)
RUN pnpm build

# --- Runner stage: minimal runtime image ---
FROM node:20-bookworm-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

# Copy the standalone server and static files from the builder
# .next/standalone contains server.js and a pruned node_modules
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Static assets
COPY --from=builder /app/public ./public

# Prisma CLI and schema for runtime db push
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/packages/api/prisma ./packages/api/prisma

# Entrypoint that runs prisma db push then starts the server
COPY --from=builder /app/scripts/docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

# Use the non-root node user provided by the base image
USER node

EXPOSE 3000
ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["node", "server.js"]
