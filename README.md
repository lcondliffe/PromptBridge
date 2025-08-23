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
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser.

In the UI:
- Click “Set API Key” and paste your OpenRouter API key (stored in localStorage)
- Choose one or more models
- Type a prompt and press Enter or click Send
- Optionally adjust advanced sampling (temperature, top-p, etc.)

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Security
- Your API key is stored in your browser’s localStorage only; no backend is used.
- The app sends requests directly to OpenRouter.

---

## Container build and run

This repo includes a Dockerfile that produces a slim, standalone Next.js server image.

Build locally:

```bash
docker build -t promptbridge:local .
```

Run locally:

```bash
docker run --rm -p 3000:3000 promptbridge:local
```

Open http://localhost:3000 and set your OpenRouter API key in the UI. No server-side secrets are required.

Notes:
- The image uses Node 20 (Debian bookworm-slim) and runs as a non-root user.
- The build leverages Next.js `output: 'standalone'` to keep runtime small.

## CI/CD (GitHub Actions)

Workflow: `.github/workflows/ci.yml`

What it does:
- Lint and typecheck using ESLint and TypeScript (`pnpm lint`, `pnpm exec tsc --noEmit`).
- Security checks (run concurrently):
  - Gitleaks for secret scanning (fails job on findings).
  - Semgrep SAST (non-blocking today; uploads SARIF to GitHub Code Scanning).
- Compute a semantic version via GitVersion.
- Build the Docker image with Buildx, scan it using Trivy (fails on HIGH/CRITICAL; uploads SARIF).
- Push to GHCR (`ghcr.io/<owner>/<repo>`) only for pushes to `main` or when tags are created. Tags pushed:
  - `<SemVer>` from GitVersion
  - `latest` (only on `main`)

Required repository settings/permissions:
- Actions permissions must allow `Read and write` for packages (for GHCR).
- The default `GITHUB_TOKEN` is used for pushing images and uploading SARIF.

---

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!
