import fs from 'node:fs';
import path from 'node:path';

export function getVersionSync(): string {
  // Try environment variables first
  const envVal = process.env.NEXT_PUBLIC_APP_VERSION || process.env.APP_VERSION;
  if (envVal) {
    return envVal;
  }

  // Try reading from file
  const fileFromEnv = process.env.APP_VERSION_FILE;
  const defaultFile = path.join(process.cwd(), 'public', 'version.txt');
  const candidate = fileFromEnv || defaultFile;

  try {
    const content = fs.readFileSync(candidate, 'utf8').trim();
    if (content) {
      return content;
    }
  } catch {
    // File doesn't exist or can't be read, continue to fallback
  }

  return 'unknown';
}