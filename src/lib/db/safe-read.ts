/** Display-only synchronous fallback; write and spend-refusal paths must propagate errors. */
export function safeRead<T>(read: () => T, fallback: T): T {
  try {
    return read();
  } catch {
    return fallback;
  }
}
