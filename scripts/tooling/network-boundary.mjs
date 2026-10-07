export function configuredPublicOrigin(environment = process.env) {
  const raw = environment.PS_PUBLIC_ORIGIN;
  if (!raw) throw new Error("PS_PUBLIC_ORIGIN is required for network startup");
  let origin;
  try { origin = new URL(raw); } catch { throw new Error("PS_PUBLIC_ORIGIN must be an absolute HTTP(S) origin"); }
  if (origin.origin !== raw || origin.username || origin.password || origin.search || origin.hash) {
    throw new Error("PS_PUBLIC_ORIGIN must contain only a scheme, host and optional port");
  }
  if (origin.protocol !== "https:" && origin.protocol !== "http:") {
    throw new Error("PS_PUBLIC_ORIGIN must use HTTP or HTTPS");
  }
  return origin;
}

export function selectedNetworkMode(origin, environment = process.env) {
  const insecure = environment.PS_INSECURE_LAN_HTTP === "1";
  const privateProxy = environment.PS_PRIVATE_PROXY_NETWORK === "1";
  if (insecure === privateProxy) {
    throw new Error("Choose exactly one network mode: PS_INSECURE_LAN_HTTP=1 or PS_PRIVATE_PROXY_NETWORK=1");
  }
  if (insecure && origin.protocol !== "http:") {
    throw new Error("Insecure LAN mode requires an http:// PS_PUBLIC_ORIGIN");
  }
  if (privateProxy && origin.protocol !== "https:") {
    throw new Error("Private-proxy mode requires an https:// PS_PUBLIC_ORIGIN");
  }
  return insecure ? "insecure-lan" : "private-proxy";
}
