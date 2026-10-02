/** Read configured token names without retaining or exposing their values. */
export function readEnvTokenPresence(content: string): ReadonlySet<string> {
  const present = new Set<string>();
  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();
    if (line.startsWith("#")) continue;
    const equals = line.indexOf("=");
    if (equals <= 0) continue;
    const key = line.slice(0, equals).trim();
    let value = line.slice(equals + 1).trim();
    if (!value || value.startsWith("#")) continue;
    const quote = value[0];
    if ((quote === '"' || quote === "'") && value.endsWith(quote)) {
      value = value.slice(1, -1);
    }
    if (value && value !== "changeme") present.add(key);
  }
  return present;
}

/** WhatsApp accepts either its API key or its phone ID. */
export function hasToken(present: ReadonlySet<string>, ...keys: string[]): boolean {
  return keys.some((key) => present.has(key));
}
