# PromptBridge

A clean web UI to send a single prompt to multiple LLMs (via OpenRouter) and view each model’s response in its own pane, side-by-side.

## Features

- Browse and select multiple models (fetched from OpenRouter)
- Paste your OpenRouter API key (stored locally in your browser)
- Send a prompt once; responses stream into separate panes
- Per-pane Stop/Copy and a global Stop all control
- Light/dark-friendly Tailwind UI

## Getting Started

Prerequisites:
- Node 20+ (recommended via .nvmrc)
- pnpm (Corepack-enabled)

First, run the development server:

```bash
pnpm install
cp .env.example .env
# Set AUTH_SECRET and DATABASE_URL (and optionally AUTH_URL)
pnpm dev
```

During `pnpm dev` and `pnpm start`, the app will automatically ensure the database schema exists by running `prisma db push` on startup (idempotent). If the DB is unavailable, startup continues and you can retry later.

Open [http://localhost:3000](http://localhost:3000) with your browser.

In the UI:
- Open the sidebar (burger) and navigate to Settings. Paste your OpenRouter API key (stored in localStorage).
- Choose one or more models
- Type a prompt and press Enter or click Send
- Optionally adjust advanced sampling (temperature, top-p, etc.)

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Security
- Your API key is stored in your browser’s localStorage only; no backend is used.
- The app sends requests directly to OpenRouter.

---

## New: API, Auth, and Persistence

- API is implemented via Next.js Route Handlers at `src/app/api/*` and all DB access is isolated in `packages/api` (repository/service layer with Prisma). Chat history is available at `/history` with detail view at `/history/[id]`.
- A first-party internal SDK lives at `packages/sdk` and is used by the frontend; it speaks to `/api` in dev and can be pointed to a split base via `NEXT_PUBLIC_API_BASE_URL`.
- Authentication uses NextAuth (Credentials provider) with a simple email/password flow. The app is gated by middleware; public routes: `/login`, `/api/auth/*`, `/api/health`, `/api/status`, and `/api/register` (only to allow first-run admin creation).
- Persistence is Postgres via Prisma with the following models: `User`, `Conversation`, `Message`.

Local setup:

```bash
# (macOS only) ensure the Podman VM is running
podman machine start

# Start Postgres locally via Podman Compose
podman compose up -d db

# Install deps
pnpm install
cp .env.example .env
# Edit .env to set NEXTAUTH_SECRET (random string)

# Option A (dev server): run the app locally
pnpm dev

# Option B (containers): run the full stack with Podman Compose (see below)
```

Quick test:
- Visit `/login`. If the database is empty (no users), the page will prompt you to create the initial admin. Otherwise, it shows the sign-in form.
- After signing in, visit `/history` to browse and manage your chat history.

## Push the DB schema with pnpm
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
- For production, prefer versioned migrations (prisma migrate deploy). See TODO below.

## Run with Podman Compose (default)

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
- The runtime container no longer runs `prisma db push` automatically. Run the one-off `migrate` job as shown.
- The image uses Node 20 (Debian bookworm-slim), runs as a non-root user, and leverages Next.js `output: 'standalone'` to keep the runtime small.
- If you hit OOM during image build (exit code 137), increase Podman VM resources:
  ```bash
  podman machine stop
  podman machine set --memory 6144 --cpus 3
  podman machine start
  ```

## Single-image build and run (optional)
You can also run the app container by itself. Ensure your database is reachable and has the schema applied (via `podman compose run --rm migrate` or `pnpm prisma:db:push`).

Build:
```bash
podman build -t promptbridge:local .
```
Run (pointing at a host Postgres):
```bash
podman run --rm -p 3000:3000 \
  -e DATABASE_URL=postgresql://postgres:postgres@host.containers.internal:5432/promptbridge \
  -e NEXTAUTH_SECRET=replace-me \
  -e NEXTAUTH_URL=http://localhost:3000 \
  -e NEXT_PUBLIC_API_BASE_URL=/api \
  promptbridge:local
```

Open http://localhost:3000 and set your OpenRouter API key in the UI.

### Future improvement (TODO)
Switch from `prisma db push` to Prisma Migrations (`prisma migrate deploy`) for production-grade, versioned schema management. The compose `migrate` service can be updated accordingly.
