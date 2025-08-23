# syntax=docker/dockerfile:1

# --- Dependencies stage: install node_modules with pnpm ---
FROM node:20-bookworm-slim AS deps
WORKDIR /app

# Enable corepack to get pnpm from lockfile / packageManager if present
RUN corepack enable

# Copy only manifests to leverage Docker layer caching
COPY package.json pnpm-lock.yaml ./

# Install deps (respects pnpm-lock.yaml)
RUN pnpm install --frozen-lockfile

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

# If you add public/ assets in future, uncomment the next line
# COPY --from=builder /app/public ./public

# Use the non-root node user provided by the base image
USER node

EXPOSE 3000
CMD ["node", "server.js"]
