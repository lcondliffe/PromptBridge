<div align="left">
  <img src="public/logo.webp" alt="PromptBridge Logo" height="48" style="vertical-align: middle; margin-right: 12px;" />
  <span style="font-size: 2em; font-weight: bold; vertical-align: middle;">PromptBridge</span>
</div>

A clean web UI to send a single prompt to multiple LLMs (via OpenRouter) and view each model’s response in its own pane, side-by-side.

## Features

- Browse and select multiple models (fetched from OpenRouter)
- Paste your OpenRouter API key (stored locally in your browser)
- Send a prompt once; responses stream into separate panes
- Per-pane Stop/Copy and a global Stop all control
- Light/dark-friendly Tailwind UI

## Tech Stack

### App / Framework

<img src="https://cdn.simpleicons.org/nextdotjs/000000" alt="Next.js" height="34" /> &nbsp;&nbsp; <img src="https://cdn.simpleicons.org/react/61DAFB" alt="React" height="34" /> &nbsp;&nbsp; <img src="https://cdn.simpleicons.org/typescript/3178C6" alt="TypeScript" height="34" /> &nbsp;&nbsp; <img src="https://cdn.simpleicons.org/tailwindcss/06B6D4" alt="Tailwind CSS" height="34" />

### Auth

<img src="https://cdn.simpleicons.org/clerk/000000" alt="Clerk" height="34" />

### DB / ORM

<img src="https://cdn.simpleicons.org/postgresql/4169E1" alt="PostgreSQL" height="34" /> &nbsp;&nbsp; <img src="https://cdn.simpleicons.org/prisma/2D3748" alt="Prisma" height="34" />

### Tooling

<img src="https://cdn.simpleicons.org/pnpm/F69220" alt="pnpm" height="34" /> &nbsp;&nbsp; <img src="https://cdn.simpleicons.org/eslint/4B32C3" alt="ESLint" height="34" /> &nbsp;&nbsp; <img src="https://cdn.simpleicons.org/podman/892CA0" alt="Podman" height="34" />

## Security
- Your API key is stored in your browser’s localStorage only; no backend is used.
- The app sends requests directly to OpenRouter.

---

## API, Auth, and Persistence

- API is implemented via Next.js Route Handlers at `src/app/api/*` and all DB access is isolated in `packages/api` (repository/service layer with Prisma). Chat history is available at `/history` with detail view at `/history/[id]`.
- A first-party internal SDK lives at `packages/sdk` and is used by the frontend; it speaks to `/api` in dev and can be pointed to a split base via `NEXT_PUBLIC_API_BASE_URL`.
- Authentication uses NextAuth (Credentials provider) with a simple email/password flow. The app is gated by middleware; public routes: `/login`, `/api/auth/*`, `/api/health`, `/api/status`, and `/api/register` (only to allow first-run admin creation).
- Persistence is Postgres via Prisma with the following models: `User`, `Conversation`, `Message`.


## Postgres Schema Deployment
You can apply the Prisma schema to any reachable Postgres instance using the pnpm script in this repo. Avoid inlining secrets; use environment variables.

Example (remote or local Postgres):

```bash
# Replace placeholders and set connection details
DB_HOST={{DB_HOST}}        # e.g. db.example.com or 127.0.0.1
DB_USER=promptbridge
DB_NAME=promptbridge
DB_PASSWORD={{DB_PASSWORD}}

# Optional: enforce SSL for managed services
# (omit if your server doesn't require SSL)
SSL_QUERY="&sslmode=require"

export DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:5432/${DB_NAME}?schema=public${SSL_QUERY}"

# Push schema (idempotent). This will create/update tables to match Prisma models.
pnpm prisma:db:push
```

Notes:
- For the local compose database from this repo, you can use:
  - `export DATABASE_URL=postgresql://postgres:postgres@localhost:5432/promptbridge`
  - `pnpm prisma:db:push`
- For production, prefer versioned migrations (prisma migrate deploy).

## Run local stack with Podman Compose

Use Podman Compose to run the full stack locally (database + app). The compose file includes a one-off `migrate` service that applies the Prisma schema before the app starts.

```bash
# 1) Start the Podman VM (macOS)
podman machine start

# 2) Build images (first time or after changes)
podman compose build app migrate

# 3) Start the database and wait until healthy
podman compose up -d db

# 4) Apply the Prisma schema once (idempotent)
podman compose run --rm migrate

# 5) Start the app
podman compose up -d app

# View logs / status
podman compose ps
podman compose logs --tail=200 app

# Stop everything
podman compose down
```

Notes:
- Podman is the default tooling. If you prefer Docker, swap `podman` for `docker` in the commands above.
- The image uses Node 20 (Debian bookworm-slim), runs as a non-root user, and leverages Next.js `output: 'standalone'` to keep the runtime small.
- If you hit OOM during image build (exit code 137), increase Podman VM resources:
  ```bash
  podman machine stop
  podman machine set --memory 6144 --cpus 3
  podman machine start
  ```
- Podman is the default tooling. If you prefer Docker, swap `podman` for `docker` in the commands above.
- The image uses Node 20 (Debian bookworm-slim), runs as a non-root user, and leverages Next.js `output: 'standalone'` to keep the runtime small.
- If you hit OOM during image build (exit code 137), increase Podman VM resources:
  ```bash
  podman machine stop
  podman machine set --memory 6144 --cpus 3
  podman machine start
  ```
