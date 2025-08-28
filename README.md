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
# Set NEXTAUTH_SECRET and DATABASE_URL (and optionally NEXTAUTH_URL)
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
# Start Postgres
docker compose up -d db

# Install deps and push schema
pnpm install
cp .env.example .env
# Edit .env to set NEXTAUTH_SECRET (random string)

# Create DB schema (no data loss in dev):
pnpm prisma:db:push

# Run app
pnpm dev
```

Quick test:
- Visit `/login`. If the database is empty (no users), the page will prompt you to create the initial admin. Otherwise, it shows the sign-in form.
- After signing in, visit `/history` to browse and manage your chat history.

## Container build and run

This repo’s runtime container automatically runs `prisma db push` on startup to create the schema if it’s missing. This is safe to run repeatedly. If the schema deployment fails (e.g., DB unavailable), the container exits with a non-zero status so orchestrators can restart it.

This repo includes a Dockerfile that produces a slim, standalone Next.js server image.

Build locally:

```bash
docker build -t promptbridge:local .
```

Run locally:

```bash
docker run --rm -p 3000:3000 \
  -e DATABASE_URL=postgresql://postgres:postgres@host.docker.internal:5432/promptbridge \
  -e NEXTAUTH_SECRET=replace-me \
  -e NEXTAUTH_URL=http://localhost:3000 \
  -e NEXT_PUBLIC_API_BASE_URL=/api \
  promptbridge:local
```

Open http://localhost:3000 and set your OpenRouter API key in the UI. No server-side secrets are required.

Notes:
- The image uses Node 20 (Debian bookworm-slim) and runs as a non-root user.
- The build leverages Next.js `output: 'standalone'` to keep runtime small.
- For local DB, run `docker compose up -d db`.
- On container start, a lightweight entrypoint executes `prisma db push` using the bundled Prisma CLI and your `DATABASE_URL`.

### Future improvement (TODO)
Migrate from `prisma db push` to Prisma Migrations (`prisma migrate deploy`) for production-grade, versioned schema management.
