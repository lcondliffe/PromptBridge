# PromptBridge

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
- Authentication uses Clerk with professional sign-in/sign-up UI. The app is gated by middleware; protected routes require authentication, while auth routes (`/login/*`, `/register/*`) and public APIs (`/api/health`, `/api/status`) are accessible without authentication.
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

# 2) Build the app image (first time or after changes)
# No secrets needed - all Clerk keys provided at runtime only
podman build -t promptbridge-app .
podman tag promptbridge-app localhost/promptbridge-app:latest

# 3) Build the migrate service
podman compose build migrate

# 4) Start the database and wait until healthy
podman compose up -d db

# 5) Apply the Prisma schema once (idempotent)
podman compose run --rm migrate

# 6) Start the app (Clerk keys loaded from .env at runtime)
podman compose up -d app

# View logs / status
podman compose ps
podman compose logs --tail=200 app

# Stop everything
podman compose down
```

Notes:
- **Environment Variables**: All Clerk keys are provided at runtime via your `.env` file. No keys needed during build. Ensure you have:
  - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_publishable_key`
  - `CLERK_SECRET_KEY=your_secret_key`
- **Security**: The container image contains no authentication keys, making it safe for public distribution and multi-environment use.
- Podman is the default tooling. If you prefer Docker, swap `podman` for `docker` in the commands above.
- The image uses Node 20 (Debian bookworm-slim), runs as a non-root user, and leverages Next.js `output: 'standalone'` to keep the runtime small.
- If you hit OOM during image build (exit code 137), increase Podman VM resources:
  ```bash
  podman machine stop
  podman machine set --memory 6144 --cpus 3
  podman machine start
  ```
