# Multi LLM Researcher

A clean web UI to send a single prompt to multiple LLMs (via OpenRouter), view each model’s response in its own pane, and then use a nominated model to summarize for consensus, contradictions, caveats, and recommendations.

## Features

- Select multiple models and one summarizer model (fetched from OpenRouter)
- Paste your OpenRouter API key (stored locally in your browser)
- Send a prompt once; responses stream into separate panes
- Generate a structured summary from a nominated model
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
- Choose one or more models, and a summarizer model
- Type a prompt and press Enter or click Send
- Optionally click “Summarize” to synthesize consensus and contradictions

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Security
- Your API key is stored in your browser’s localStorage only; no backend is used.
- The app sends requests directly to OpenRouter.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
