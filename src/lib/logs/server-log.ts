type ServerLogTag = "auth" | "config" | "paths" | "deep-research" | "chat"
  | "scheduler" | "seed" | "sessions" | "db" | "composer";
type ServerLogLevel = "log" | "info" | "warn" | "error";

/** Keep subsystem tags stable without changing existing console streams or arguments. */
export function serverLog(tag: ServerLogTag, level: ServerLogLevel, message: string, ...details: unknown[]): void {
  console[level](`[${tag}] ${message}`, ...details);
}
