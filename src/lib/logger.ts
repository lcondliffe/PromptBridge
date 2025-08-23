// Simple logger utility with structured console output and in-memory history
// Usage: log(level, domain, event, data)
// Levels: 'debug' | 'info' | 'warn' | 'error'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const history: { ts: number; level: LogLevel; domain: string; event: string; data?: unknown }[] = [];

export function log(level: LogLevel, domain: string, event: string, data?: unknown) {
  const entry = { ts: Date.now(), level, domain, event, data };
  history.push(entry);
  const prefix = `[${new Date(entry.ts).toISOString()}][${level.toUpperCase()}][${domain}] ${event}`;
  if (level === 'error') console.error(prefix, data ?? '');
  else if (level === 'warn') console.warn(prefix, data ?? '');
  else console.log(prefix, data ?? '');
}

export function getLogs(limit = 200) {
  return history.slice(-limit);
}

export function clearLogs() {
  history.length = 0;
}

