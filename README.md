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
- Open the sidebar (burger) and navigate to Settings. Paste your OpenRouter API key (stored in localStorage).
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
