/** @jest-environment node */
// T-0207 independent oracle. All sockets terminate at disposable owned listeners.
// The connector maps logical admitted addresses to fixtures; no public IP is dialled.
import { createRequire } from "node:module";
import { generateKeyPairSync, sign } from "node:crypto";
import { join } from "node:path";
import { readFileSync } from "node:fs";
import { createServer, get, type Server, type ServerResponse } from "node:http";
import { createServer as createSecureServer, get as secureGet } from "node:https";
import { Socket, type LookupFunction } from "node:net";
import type { ConnectionOptions } from "node:tls";
import { gzipSync, deflateSync, brotliCompressSync } from "node:zlib";

type Address = { address: string; family: number };
type ConnectorInput = { hostname: string; host?: string; protocol: string; port: string; servername?: string };
type Connector = (options: ConnectorInput, callback: (error: Error | null, socket: Socket | null) => void) => void;
type AgentOptions = { connect?: (ConnectionOptions & { lookup?: LookupFunction }) | Connector };
type OwnedAgent = { close(): Promise<void>; destroy(error?: Error): Promise<void>; closed: boolean; destroyed: boolean };
type FetchOptions = RequestInit & { dispatcher?: OwnedAgent };
type Runtime = {
  Agent: new (options?: AgentOptions) => OwnedAgent;
  buildConnector(options: ConnectionOptions & { lookup?: LookupFunction }): Connector;
  fetch(input: string | URL, options?: FetchOptions): Promise<Response>;
};

// Root resolution wins. A wrong installed version cannot silently use the bootstrap.
const rootRequire = createRequire(join(process.cwd(), "package.json"));
let selectedRequire = rootRequire;
try { rootRequire.resolve("undici"); } catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "MODULE_NOT_FOUND") throw error;
  selectedRequire = createRequire(join(process.cwd(), "tmp/t0207-runtime/package.json"));
}
const runtimeEntry = selectedRequire.resolve("undici");
const runtimeVersion = JSON.parse(readFileSync(selectedRequire.resolve("undici/package.json"), "utf8")).version;
const runtime = selectedRequire(runtimeEntry) as Runtime;
const HOST = "owned-rebinding.invalid";
const PUBLIC = "8.8.8.8";
const SECOND = "1.1.1.1";
const PRIVATE = "127.0.0.1";
const admitted = [{ address: PUBLIC, family: 4 }];
const HTML = "<title>Owned approved</title><script>discard-me</script><p>approved-marker &amp; readable</p>";
// Ephemeral TLS fixture, generated only in memory. No private key is committed,
// no OpenSSL executable or certificate store is required in fresh CI.
function tlsIdentity() {
  const pair = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const der = (tag: number, ...parts: Buffer[]) => {
    const body = Buffer.concat(parts), size = body.length;
    const length = size < 128 ? [size] : size < 256 ? [0x81, size] : [0x82, size >> 8, size & 255];
    return Buffer.concat([Buffer.from([tag, ...length]), body]);
  };
  const seq = (...parts: Buffer[]) => der(0x30, ...parts);
  const oid = (hex: string) => der(0x06, Buffer.from(hex, "hex"));
  const algorithm = seq(oid("2a8648ce3d040302")); // ecdsa-with-SHA256
  const name = seq(der(0x31, seq(oid("550403"), der(0x0c, Buffer.from(HOST)))));
  const extensions = der(0xa3, seq(
    seq(oid("551d11"), der(0x04, seq(der(0x82, Buffer.from(HOST))))),
    seq(oid("551d13"), der(0x04, seq(der(0x01, Buffer.from([0xff]))))),
  ));
  const tbs = seq(
    der(0xa0, der(0x02, Buffer.from([2]))), der(0x02, Buffer.from([1])), algorithm, name,
    seq(der(0x18, Buffer.from("20250101000000Z")), der(0x18, Buffer.from("20450101000000Z"))),
    name, pair.publicKey.export({ type: "spki", format: "der" }), extensions,
  );
  const certificate = seq(tbs, algorithm, der(0x03, Buffer.from([0]), sign("sha256", tbs, pair.privateKey)));
  const cert = "-----BEGIN CERTIFICATE-----\n" + certificate.toString("base64").match(/.{1,64}/g)!.join("\n") + "\n-----END CERTIFICATE-----\n";
  return { cert, key: pair.privateKey.export({ type: "pkcs8", format: "pem" }) };
}
const { cert: CERT, key: KEY } = tlsIdentity();

type AgentRecord = { agent: OwnedAgent; pins: Address[][]; inputs: ConnectorInput[]; shutdown: Promise<void>[] };
let allowed: Server, forbidden: Server, secure: Server;
let allowedPort: number, forbiddenPort: number, securePort: number;
let agents: AgentRecord[] = [];
let fixtureAgents: OwnedAgent[] = [];
let hits: { kind: string; path: string; host: string | undefined; servername: string | undefined }[] = [];
const sockets = new Set<Socket>();
let connectorErrors: Error[] = [];
let violations: string[] = [];
let dnsCalls: string[] = [];
let fetchCalls: FetchOptions[] = [];
let transportAnswer = PUBLIC;
let resolveDns: (hostname: string) => Promise<Address[]>;
let bodyArrived: (() => void) | undefined;
const originalFetch = global.fetch;
const nativeSetTimeout = global.setTimeout;
const nativeClearTimeout = global.clearTimeout;
const nativeConnect = Socket.prototype.connect;
const ownedLookups = new Set<LookupFunction>();

// Fail closed below the module mock: a resolver regression must never dial a
// public address. Only owned ports and literal loopback or our exact fixture
// lookup are admitted. TLS still verifies the original hostname/certificate.
function fencedConnect(this: Socket, ...args: unknown[]): Socket {
  const options = (Array.isArray(args[0]) ? args[0][0] : args[0]) as
    { host?: string; port?: string | number; lookup?: LookupFunction } | undefined;
  if (!options || ![allowedPort, forbiddenPort, securePort].includes(Number(options.port)) ||
      (options.host !== PRIVATE && (!options.lookup || !ownedLookups.has(options.lookup)))) {
    violations.push("INFRASTRUCTURE: unowned native connection blocked");
    throw new Error("INFRASTRUCTURE: unowned native connection blocked");
  }
  return Reflect.apply(nativeConnect, this, args);
}

function port(server: Server): number {
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("INFRASTRUCTURE: fixture has no TCP port");
  return address.port;
}
async function listen(server: Server): Promise<number> {
  server.on("connection", socket => { sockets.add(socket); socket.once("close", () => sockets.delete(socket)); });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject); server.listen(0, PRIVATE, resolve);
  });
  return port(server);
}
function serve(kind: string, request: import("node:http").IncomingMessage, response: ServerResponse) {
  const path = request.url ?? "/";
  hits.push({ kind, path, host: request.headers.host, servername: (request.socket as Socket & { servername?: string }).servername });
  if (kind === "forbidden") { response.writeHead(200, { "content-type": "text/plain" }); response.end("forbidden-marker"); return; }
  const base = `http://${HOST}:${forbiddenPort}`;
  const redirects: Record<string, string> = {
    "/redirect": "/final", "/repin": "/final",
    "/inward": `http://${PRIVATE}:${forbiddenPort}/`,
    "/mixed-hop": `http://mixed.invalid:${forbiddenPort}/`,
    "/credential-hop": `http://user:password@${HOST}:${forbiddenPort}/`,
    "/budget-hop": "/quiet-body",
  };
  const chain = /^\/chain\/(\d+)$/.exec(path);
  const location = redirects[path] ?? (chain && Number(chain[1]) > 0 ? `${base}/chain/${Number(chain[1]) - 1}` : undefined);
  if (location) { response.writeHead(302, { location }); response.end("redirect body"); return; }
  if (path === "/quiet-body" || path === "/non-text") {
    response.writeHead(200, { "content-type": path === "/non-text" ? "application/octet-stream" : "text/plain" });
    response.write("partial-body"); bodyArrived?.(); return;
  }
  const encoding = path.slice(1);
  const compressed = encoding === "gzip" ? gzipSync(HTML) : encoding === "deflate" ? deflateSync(HTML) : encoding === "br" ? brotliCompressSync(HTML) : null;
  response.writeHead(200, { "content-type": "text/html", ...(compressed ? { "content-encoding": encoding } : {}) });
  response.end(compressed ?? HTML);
}
async function direct(url: string, tls = false): Promise<string> {
  return new Promise((resolve, reject) => {
    const request = (tls ? secureGet : get)(url, tls ? { ca: CERT, servername: HOST, agent: false } : { agent: false }, response => {
      let text = ""; response.setEncoding("utf8"); response.on("data", chunk => { text += chunk; });
      response.on("end", () => resolve(text)); response.on("error", reject);
    });
    request.on("error", reject); request.setTimeout(2000, () => request.destroy(new Error("INFRASTRUCTURE: preflight timeout")));
  });
}
async function bounded<T>(promise: Promise<T>, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([promise, new Promise<never>((_, reject) => {
      timer = nativeSetTimeout(() => reject(new Error(`CONTROL SETTLEMENT: ${label}`)), 2000);
    })]);
  } finally { if (timer) nativeClearTimeout(timer); }
}

// Only the supported Agent connect/lookup boundary is substituted. Actual fetch,
// HTTP parsing, stream cancellation and TLS verification execute underneath it.
function fixtureConnector(options: AgentOptions, record?: AgentRecord): Connector {
  return (input, callback) => {
    record?.inputs.push({ ...input });
    if (![HOST, "mixed.invalid", "wrong-name.invalid"].includes(input.hostname)) {
      violations.push(`Unexpected network hostname ${input.hostname}`);
      callback(new Error("INFRASTRUCTURE: unexpected destination"), null); return;
    }
    const connect = typeof options.connect === "object" ? options.connect : {};
    if (typeof options.connect === "function") violations.push("Expected accepted Agent connect.lookup contract");
    const pin = connect.lookup;
    const finish = (error: Error | null, addresses: Address[]) => {
      if (error) { callback(error, null); return; }
      record?.pins.push(addresses);
      if (!addresses.length || addresses.some(a => ![PUBLIC, SECOND, PRIVATE, "2606:4700:4700::1111"].includes(a.address))) {
        violations.push("Unexpected logical address"); callback(new Error("INFRASTRUCTURE: unmapped address"), null); return;
      }
      const forbiddenAddress = addresses.some(a => a.address === PRIVATE);
      const target = forbiddenAddress ? forbiddenPort : input.protocol === "https:" ? securePort : allowedPort;
      const ownedLookup: LookupFunction = (_hostname, lookupOptions, done) => {
        if (lookupOptions.all) done(null, [{ address: PRIVATE, family: 4 }]); else done(null, PRIVATE, 4);
      };
      ownedLookups.add(ownedLookup);
      const connector = runtime.buildConnector({ ...connect, ca: CERT, lookup: ownedLookup });
      connector({ ...input, port: String(target) }, (connectionError, socket) => {
        if (connectionError) connectorErrors.push(connectionError);
        callback(connectionError, socket);
      });
    };
    if (pin) {
      let calls = 0;
      pin(input.hostname, { all: true }, (error, address, family) => {
        if (++calls !== 1) { violations.push("Pin callback invoked twice"); return; }
        finish(error, Array.isArray(address) ? address : [{ address, family: family ?? 0 }]);
      });
    } else finish(null, [{ address: transportAnswer, family: 4 }]);
  };
}
function RecordingAgent(options: AgentOptions = {}): OwnedAgent {
  const record = { pins: [], inputs: [], shutdown: [] } as unknown as AgentRecord;
  const agent = new runtime.Agent({ ...options, connect: fixtureConnector(options, record) });
  record.agent = agent;
  for (const name of ["close", "destroy"] as const) {
    const original = agent[name];
    // Preserve callback overloads: Undici's promise form calls its own public
    // method again with a callback. Dropping that callback would recurse.
    agent[name] = ((...args: unknown[]) => {
      const pending = Reflect.apply(original, agent, args) as Promise<void> | undefined;
      if (pending?.then) record.shutdown.push(pending);
      return pending;
    }) as typeof agent[typeof name];
  }
  agents.push(record); return agent;
}
async function fixtureFetch(input: string | URL, options: FetchOptions = {}): Promise<Response> {
  fetchCalls.push(options);
  let dispatcher = options.dispatcher;
  if (!dispatcher) {
    dispatcher = new runtime.Agent({ connect: fixtureConnector({}) }); fixtureAgents.push(dispatcher);
  }
  return runtime.fetch(input, { ...options, dispatcher });
}
async function subject() {
  return await import("@/lib/search/visit");
}
function url(path = "/", protocol = "http", hostname = HOST) {
  return `${protocol}://${hostname}:${forbiddenPort}${path}`;
}
async function released() {
  expect(agents.length).toBeGreaterThan(0);
  for (const record of agents) {
    expect(record.shutdown.length).toBeGreaterThan(0);
    await bounded(Promise.all(record.shutdown), "owned dispatcher shutdown");
    expect(record.agent.destroyed).toBe(true);
  }
  await waitForSockets();
  expect(sockets.size).toBe(0);
}
async function waitForSockets() {
  const deadline = Date.now() + 1000;
  while (sockets.size && Date.now() < deadline) await new Promise<void>(resolve => nativeSetTimeout(resolve, 5));
}

beforeAll(async () => {
  if (runtimeVersion !== "8.11.2") throw new Error(`INFRASTRUCTURE: expected Undici 8.11.2, got ${runtimeVersion}`);
  allowed = createServer((request, response) => serve("approved", request, response));
  forbidden = createServer((request, response) => serve("forbidden", request, response));
  secure = createSecureServer({ cert: CERT, key: KEY }, (request, response) => serve("tls", request, response));
  allowedPort = await listen(allowed); forbiddenPort = await listen(forbidden); securePort = await listen(secure);
  Socket.prototype.connect = fencedConnect as typeof Socket.prototype.connect;
  // A listener or certificate failure is a beforeAll infrastructure failure,
  // never the matcher that establishes the baseline security red.
  expect(await direct(`http://${PRIVATE}:${allowedPort}/`)).toBe(HTML);
  expect(await direct(`http://${PRIVATE}:${forbiddenPort}/`)).toBe("forbidden-marker");
  expect(await direct(`https://${PRIVATE}:${securePort}/`, true)).toBe(HTML);
  await waitForSockets();
  expect(sockets.size).toBe(0);
}, 10000);
beforeEach(() => {
  ownedLookups.clear();
  jest.resetModules(); hits = []; agents = []; fixtureAgents = []; violations = []; connectorErrors = [];
  dnsCalls = []; fetchCalls = []; transportAnswer = PUBLIC; bodyArrived = undefined;
  resolveDns = async hostname => hostname === "mixed.invalid" ? [...admitted, { address: PRIVATE, family: 4 }] : admitted;
  const dns = { lookup: jest.fn(async (hostname: string) => { dnsCalls.push(hostname); return resolveDns(hostname); }) };
  jest.doMock("dns/promises", () => dns); jest.doMock("node:dns/promises", () => dns);
  jest.doMock("undici", () => ({ ...runtime, Agent: RecordingAgent, fetch: fixtureFetch }));
  global.fetch = fixtureFetch as typeof fetch;
});
afterEach(async () => {
  jest.useRealTimers(); global.fetch = originalFetch;
  // Safety cleanup happens after assertions; it cannot make a leak assertion pass.
  await Promise.all([...agents.map(record => record.agent), ...fixtureAgents].map(agent => agent.destroy()));
  for (const server of [allowed, forbidden, secure]) server?.closeAllConnections();
  await new Promise<void>(resolve => setImmediate(resolve));
  jest.restoreAllMocks(); jest.dontMock("undici"); jest.dontMock("dns/promises"); jest.dontMock("node:dns/promises");
  expect(violations).toEqual([]);
});
afterAll(async () => {
  try {
    await Promise.all([allowed, forbidden, secure].filter(Boolean).map(server => new Promise<void>(resolve => {
      server.closeAllConnections(); server.close(() => resolve());
    })));
  } finally { Socket.prototype.connect = nativeConnect; }
});

describe("T0207 owned research transport oracle", () => {
  it("positive control: supported dispatcher retrieves the owned approved fixture", async () => {
    const lookup: LookupFunction = (_hostname, options, done) => options.all ? done(null, admitted) : done(null, PUBLIC, 4);
    const dispatcher = RecordingAgent({ connect: { lookup } });
    const response = await runtime.fetch(url(), { dispatcher });
    expect(await response.text()).toBe(HTML);
    expect(hits.map(hit => hit.kind)).toEqual(["approved"]);
    expect(agents[0].pins).toEqual([admitted]); expect(violations).toEqual([]);
    await dispatcher.close(); await released();
  });
  it.each(["gzip", "deflate", "br"])("positive allowed control: %s preserves research output", async encoding => {
    const { visitPage } = await subject(); const result = await visitPage(url(`/${encoding}`), 24);
    expect(result).toEqual({ url: url(`/${encoding}`), title: "Owned approved", content: "Owned approved approved-…" });
    expect(hits.map(hit => hit.kind)).toEqual(["approved"]); expect(violations).toEqual([]);
  });
  it("rebinding: permitted retrieval uses the admitted pin and sends zero forbidden requests", async () => {
    transportAnswer = PRIVATE;
    const { visitPage } = await subject(); const result = await visitPage(url());
    expect(hits.filter(hit => hit.kind === "forbidden")).toEqual([]);
    expect(result?.content).toContain("approved-marker");
    expect(fetchCalls).toHaveLength(1); expect(fetchCalls[0].dispatcher).toBeDefined();
    expect(dnsCalls).toEqual([HOST]); expect(agents[0].pins).toEqual([admitted]); expect(violations).toEqual([]);
    await released();
  });
  it.each([false, true])("mixed DNS refuses before transport [privateFirst=%s]", async privateFirst => {
    const mixed = [...admitted, { address: PRIVATE, family: 4 }];
    resolveDns = async () => privateFirst ? [...mixed].reverse() : mixed;
    const { checkUrlSafe } = await import("@/lib/search/url-guard");
    expect((await checkUrlSafe(url())).ok).toBe(false);
    const { visitPage } = await subject(); expect(await visitPage(url())).toBeNull();
    expect(fetchCalls).toEqual([]); expect(agents).toEqual([]); expect(hits).toEqual([]);
  });
  it("same-origin redirect obtains a fresh DNS decision and dispatcher pin", async () => {
    let reads = 0; resolveDns = async () => [{ address: ++reads === 1 ? PUBLIC : SECOND, family: 4 }];
    const { visitPage } = await subject(); expect((await visitPage(url("/repin")))?.content).toContain("approved-marker");
    expect(dnsCalls).toEqual([HOST, HOST]); expect(agents).toHaveLength(2);
    expect(agents[0].agent).not.toBe(agents[1].agent);
    expect(agents.map(record => record.pins[0][0].address)).toEqual([PUBLIC, SECOND]);
    expect(hits.map(hit => hit.path)).toEqual(["/repin", "/final"]); expect(violations).toEqual([]);
    await released();
  });
  it.each(["/inward", "/mixed-hop", "/credential-hop"])("redirect refusal releases the permitted hop [%s]", async path => {
    const { visitPage } = await subject(); expect(await visitPage(url(path))).toBeNull();
    expect(hits.map(hit => hit.path)).toEqual([path]); expect(fetchCalls).toHaveLength(1);
    await released();
  });
  it.each([[4, true], [5, false]])("four redirects remain the limit [redirects=%s]", async (count, succeeds) => {
    const { visitPage } = await subject(); const result = await visitPage(url(`/chain/${count}`));
    if (succeeds) expect(result?.content).toContain("approved-marker"); else expect(result).toBeNull();
    expect(hits).toHaveLength(5); expect(hits.every(hit => hit.kind === "approved")).toBe(true);
  });
  it("HTTPS preserves original Host and certificate hostname/SNI", async () => {
    const { visitPage } = await subject(); expect((await visitPage(url("/", "https")))?.content).toContain("approved-marker");
    expect(hits).toEqual([{ kind: "tls", path: "/", host: `${HOST}:${forbiddenPort}`, servername: HOST }]);
    expect(connectorErrors).toEqual([]); expect(violations).toEqual([]);
  });
  it("HTTPS wrong-name certificate refusal is a TLS failure, not unreachable transport", async () => {
    const { visitPage } = await subject(); expect(await visitPage(url("/", "https", "wrong-name.invalid"))).toBeNull();
    expect(hits).toEqual([]);
    expect(connectorErrors.some(error => (error as NodeJS.ErrnoException).code === "ERR_TLS_CERT_ALTNAME_INVALID")).toBe(true);
  });
  it("URL userinfo is refused by the guard before DNS or transport", async () => {
    const { checkUrlShape } = await import("@/lib/search/url-guard");
    const credentialUrl = `http://user:password@${HOST}:${forbiddenPort}/`;
    expect(checkUrlShape(credentialUrl).ok).toBe(false);
    const { visitPage } = await subject(); expect(await visitPage(credentialUrl)).toBeNull();
    expect(dnsCalls).toEqual([]); expect(fetchCalls).toEqual([]); expect(hits).toEqual([]);
  });
  it("twelve-second budget settles quiet DNS and late answers cannot connect", async () => {
    jest.useFakeTimers(); let release!: (value: Address[]) => void;
    resolveDns = () => new Promise(resolve => { release = resolve; });
    const { visitPage } = await subject(); let settled = false;
    const pending = visitPage(url()).then(result => { settled = true; return result; });
    await Promise.resolve();
    try {
      await jest.advanceTimersByTimeAsync(11999); expect(settled).toBe(false);
      await jest.advanceTimersByTimeAsync(1); expect(settled).toBe(true);
      expect(await pending).toBeNull();
    } finally {
      release(admitted); await bounded(pending, "late DNS answer");
    }
    expect(fetchCalls).toEqual([]); expect(hits).toEqual([]);
  });
  it("one twelve-second budget aborts a quiet body after a redirect and releases resources", async () => {
    const deadlines: (() => void)[] = [];
    const timerSpy = jest.spyOn(global, "setTimeout").mockImplementation(((callback: (...args: unknown[]) => void, delay?: number, ...args: unknown[]) => {
      if (delay === 12000) deadlines.push(() => callback(...args));
      return nativeSetTimeout(callback, delay, ...args);
    }) as typeof setTimeout);
    const arrived = new Promise<void>(resolve => { bodyArrived = resolve; });
    const { visitPage } = await subject(); const pending = visitPage(url("/budget-hop"));
    await bounded(arrived, "quiet body fixture reached");
    expect(deadlines).toHaveLength(1); deadlines[0]();
    expect(await bounded(pending, "body abort")).toBeNull(); timerSpy.mockRestore();
    expect(hits.map(hit => hit.path)).toEqual(["/budget-hop", "/quiet-body"]);
    await released();
  });
  it("non-text refusal cancels the held body and releases its owned dispatcher", async () => {
    const { visitPage } = await subject(); expect(await bounded(visitPage(url("/non-text")), "non-text refusal")).toBeNull();
    expect(hits.map(hit => hit.path)).toEqual(["/non-text"]); await released();
  });
});
