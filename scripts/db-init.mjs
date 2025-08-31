import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

async function main() {
  // Do NOT bail early if DATABASE_URL isn't in process.env; Prisma can load .env itself.
  // This makes local dev more robust when .env is present but not preloaded by Node.

  const schemaPath = path.resolve(process.cwd(), "packages/api/prisma/schema.prisma");
  if (!existsSync(schemaPath)) {
    console.log("[db-init] Schema file not found at:", schemaPath);
    return;
  }

  let prismaCliPath = null;
  try {
    // Resolve the Prisma CLI entry inside the workspace (works in dev installs)
    prismaCliPath = require.resolve("prisma/build/index.js");
  } catch {
    console.log("[db-init] Prisma CLI not found in this environment; skipping.");
    return;
  }

  console.log("[db-init] Ensuring database schema via `prisma db push`...");
  await new Promise((resolve) => {
    const child = spawn(process.execPath, [
      prismaCliPath,
      "db",
      "push",
      "--schema",
      schemaPath,
    ], {
      stdio: "inherit",
      env: process.env,
    });

    child.on("error", (err) => {
      console.warn("[db-init] Failed to spawn Prisma CLI:", err);
      resolve();
    });

    child.on("exit", (code, signal) => {
      if (code === 0 && !signal) {
        console.log("[db-init] Schema is up to date.");
      } else {
        console.warn(`
[db-init] WARN: prisma db push exited with code ${code ?? "null"}${signal ? ` (signal ${signal})` : ""}.
This may be fine if the DB is unavailable; the app will continue to start.
`);
      }
      resolve();
    });
  });
}

main().catch((err) => {
  console.warn("[db-init] Unexpected error:", err);
});

