/** @jest-environment node */

// T0206 independent Faraday oracle, 2026-10-04. Synthetic transport controls
// exercise the actual entry point; they are not HTTP timing acceptance.
import { spawnSync } from "node:child_process";

const control = String.raw`
import contextlib, copy, hashlib, importlib.abc, importlib.util, io, json, os
from pathlib import Path
import socket, socketserver, subprocess, sys, tempfile
from unittest.mock import patch

def load(name, file):
    spec = importlib.util.spec_from_file_location(name, Path('tests/helpers') / file)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module

phase = load('oracle_phase', 'release-http-phase-observer.py')
context = load('oracle_context', 'release-install-http-context-probe.py')
mode = sys.argv[1]
secret = 'PRIVATE-CREDENTIAL-DO-NOT-REPORT'
row = dict(accepted=False, withinDeadline=False, probeExit=124,
    ownedStopped=True, decoySurvived=True, signalsOwned=True, requestsBounded=True,
    connectBounded=True, scratchExclusive=True, scratchPrivate=True, scratchOwned=True,
    scratchRemoved=True, scratchCreatedBeforeLaunch=True, credentialLeaked=False,
    scriptContainsCredential=False, identity=[[1, 1]],
    entries=[dict(shellPid=1, bashPid=1, phase='pre' if n == 0 else 'post') for n in range(21)],
    completedExits=[52] + [28] * 19, returnedExits=[52] + [28] * 19,
    requests=[dict(path='/api/health', credential='absent', status=200)] * 20,
    native=dict(calls=21, statuses=[52] + [28] * 20, clients={'private-client-path': 'a' * 64},
        errors=0, cancelled=0, ownedCurlStopped=True, listenerStopped=True,
        ipcStopped=True, environmentRegistered=True))
decoration = dict(active=False, entries=0, exits=0, calls=[])

@contextlib.contextmanager
def recorded(report):
    decoration['entries'] += 1
    decoration['active'] = True
    try:
        yield
    finally:
        decoration['active'] = False
        decoration['exits'] += 1
        report.update(objectsRestored=True, ownedProcessesStopped=True,
            totals={'native.communicate': dict(calls=21, seconds=.21, bytes=0)},
            events=[dict(phase=label, requestId=n, startMonotonicNs=n * 100 + offset,
                endMonotonicNs=n * 100 + offset + 1, seconds=1e-9,
                calls=1, bytes=1 if label == 'bridge-recv' else 0)
                for n in range(1, 22) for label, offset in
                [('bridge-recv', 0), ('bridge-validate', 2), ('native.spawn', 4),
                 ('native.communicate', 6), ('bridge-send', 8)]])

if mode.startswith('intervals'):
    report, seen, failure = {}, [], False
    bridge_module = load('release_install_http_curl_bridge', 'release-install-http-curl-bridge.py')
    original_handler_init = socketserver.BaseRequestHandler.__init__
    def initialise(process, args, **kwargs):
        process.pid, process.returncode = 1, 28
        seen.append(args)
    def communicate(process, *args, **kwargs):
        if mode == 'intervals-exception': raise RuntimeError(secret)
        return b'000', secret.encode()
    def handler(instance, request, address, server):
        if mode == 'intervals':
            return original_handler_init(instance, request, address, server)
        process = subprocess.Popen(['/usr/bin/curl', secret])
        process.communicate()
        request.sendall(b'OK')
    class Server:
        __module__ = 'release_install_http_curl_bridge'
    originals = (subprocess.Popen.__init__, subprocess.Popen.communicate,
        socketserver.BaseRequestHandler.__init__, socket.socket.recv, socket.socket.sendall,
        Path.read_bytes, socketserver.BaseServer.shutdown, tempfile.TemporaryDirectory.cleanup)
    with patch.object(subprocess.Popen, '__init__', initialise), \
         patch.object(subprocess.Popen, 'communicate', communicate), \
         patch.object(subprocess.Popen, 'poll', lambda self: self.returncode), \
         patch.object(socketserver.BaseRequestHandler, '__init__', handler):
        request, peer = socket.socketpair()
        scratch = tempfile.TemporaryDirectory(prefix='t0206-receiver-')
        client = Path(scratch.name) / 'curl'
        client.write_bytes(secret.encode())
        bridge = bridge_module.CurlBridge(Path(scratch.name), 1, {}, sys.executable)
        bridge.launch_environment, bridge.launch_cwd = {}, scratch.name
        bridge.executable = lambda selected: client
        try:
            with phase.decorate(report):
                for n in range(21):
                    if mode == 'intervals':
                        arguments = ['--max-time', '0.1', '--connect-timeout', '0.1',
                            '-H', 'Authorization: Bearer ' + secret, 'http://127.0.0.1:1/api/health']
                        fields = ['T0202', bridge.key, str(len(arguments)), 'owned-client', *arguments]
                        peer.sendall(('\0'.join(fields) + '\0').encode())
                        bridge.server.RequestHandlerClass(request, None, bridge.server)
                        if not peer.recv(1024).startswith(b'OK\0'):
                            raise RuntimeError('Synthetic native response was not transmitted')
                    else:
                        socketserver.BaseRequestHandler(request, None, Server())
        except RuntimeError as error:
            failure = str(error) == secret
        finally:
            request.close()
            peer.close()
            bridge.server.server_close()
            scratch.cleanup()
        restored_inside = (subprocess.Popen.__init__ is initialise and
            subprocess.Popen.communicate is communicate and
            socketserver.BaseRequestHandler.__init__ is handler)
    restored = originals == (subprocess.Popen.__init__, subprocess.Popen.communicate,
        socketserver.BaseRequestHandler.__init__, socket.socket.recv, socket.socket.sendall,
        Path.read_bytes, socketserver.BaseServer.shutdown, tempfile.TemporaryDirectory.cleanup)
    print(json.dumps(dict(report=report, calls=len(seen), failure=failure, restored=restored and restored_inside,
        leaked=secret in json.dumps(report))))
elif mode.startswith('validate-'):
    validate = getattr(phase, 'validate_actual_report', None)
    measurement = {}
    with recorded(measurement): pass
    candidate = dict(diagnosticOnly=True, actualInvocation=True, case='stalled',
        measurementComplete=True, measurement=measurement, outcome=phase.selected(row),
        frozenHashes=phase.hashes(), frozenFilesUnchanged=True,
        observerSHA256=hashlib.sha256(Path(phase.__file__).read_bytes()).hexdigest(),
        conditions=dict(nativeCallsExpected=21, supervisorSeconds=6, outerSeconds=25,
            curlMaxAndConnectSeconds=.1, retries=0, readinessLoops=20))
    if mode == 'validate-missing': candidate.pop('measurement')
    if mode == 'validate-malformed': candidate['measurement'] = {'events': 'not-events'}
    if mode == 'validate-partial': candidate['measurementComplete'] = False
    rejected = False
    if callable(validate):
        try: validate(candidate)
        except (ValueError, RuntimeError): rejected = True
    print(json.dumps(dict(available=callable(validate), rejected=rejected)))
else:
    calls, output = [], io.StringIO()
    def observe(case, bash, reference=None):
        calls.append(case)
        decoration['calls'].append(dict(case=case, active=decoration['active']))
        if mode == 'exception' and case == 'stalled': raise RuntimeError(secret)
        return copy.deepcopy(row) if case == 'stalled' else {'ordinary': case}
    original_spec = importlib.util.spec_from_file_location
    class PhaseLoader(importlib.abc.Loader):
        def create_module(self, spec): return phase
        def exec_module(self, module): pass
    def module_spec(name, location, *args, **kwargs):
        if Path(location).name == 'release-http-phase-observer.py':
            return importlib.util.spec_from_loader(name, PhaseLoader())
        return original_spec(name, location, *args, **kwargs)
    with tempfile.TemporaryDirectory(prefix='t0206-oracle-') as owned:
        directory = Path(owned) / 'actual'
        directory.mkdir()
        environment = {'T0206_ACTUAL_PHASE_DIR': str(directory)} if mode != 'disabled' else {}
        environment.update(PATH=os.environ.get('PATH', ''), T0202_BASH='owned-bash',
            PRIVATE_ORACLE_ENV=secret, PYTHONDONTWRITEBYTECODE='1')
        failure = None
        with patch.dict(os.environ, environment, clear=True), \
             patch.object(sys, 'argv', ['context-probe', 'healthy', 'stalled', 'health-503']), \
             patch.object(context, 'observe', observe), \
             patch.object(context.subprocess, 'run', return_value=None), \
             patch.object(importlib.util, 'spec_from_file_location', module_spec), \
             patch.object(phase, 'decorate', recorded), contextlib.redirect_stdout(output):
            try: context.main()
            except RuntimeError as error: failure = str(error) == secret
        files = list(directory.glob('*.json'))
        receipt = json.loads(files[0].read_text()) if len(files) == 1 else None
        text = json.dumps(receipt)
        bindings = receipt.get('frozenHashes', {}) if receipt else {}
        bound = 'tests/helpers/release-install-http-context-probe.py' in bindings and all(
            hashlib.sha256(Path(file).read_bytes()).hexdigest() == value
            for file, value in bindings.items()) and receipt.get('observerSHA256') == \
            hashlib.sha256(Path(phase.__file__).read_bytes()).hexdigest()
        print(json.dumps(dict(calls=calls, stdout=output.getvalue(), failure=failure,
            receipt=receipt, receiptCount=len(files), sourceBound=bound, decoration=decoration,
            leaked=any(value in text for value in (secret, 'private-client-path')))))
`;

type Result = {
  calls: string[] | number; stdout: string; failure: boolean | null; receiptCount: number;
  sourceBound: boolean; leaked: boolean; available: boolean; rejected: boolean; restored: boolean;
  decoration: { active: boolean; entries: number; exits: number; calls: { case: string; active: boolean }[] };
  receipt: { diagnosticOnly: boolean; actualInvocation: boolean; case: string;
    measurementComplete: boolean; failureClass?: string;
    conditions: Record<string, number>;
    outcome: { counts: Record<string, number>; flags: Record<string, boolean> } } | null;
  report: { events: { phase: string; requestId: number; startMonotonicNs: number;
    endMonotonicNs: number; calls?: number; bytes?: number }[]; objectsRestored: boolean };
};
function run(mode: string): Result {
  const env: NodeJS.ProcessEnv = { NODE_ENV: "test", PYTHONDONTWRITEBYTECODE: "1", PYTHONIOENCODING: "utf-8" };
  for (const [key, value] of Object.entries(process.env)) {
    if (/^(PATH|SYSTEMROOT|WINDIR|COMSPEC|PATHEXT|TMP|TEMP)$/i.test(key)) env[key] = value;
  }
  const result = spawnSync(process.env.PYTHON || "python", ["-c", control, mode], {
    cwd: process.cwd(), env, encoding: "utf8", timeout: 10_000, maxBuffer: 1024 * 1024,
  });
  if (result.error || result.signal || result.status !== 0)
    throw new Error(`T0206 oracle infrastructure: ${result.error?.name || result.signal || result.status}`);
  return JSON.parse(result.stdout) as Result;
}

describe("T0206 actual invocation observability", () => {
  it("A01 disabled entry point preserves ordinary stdout and calls each selected case once", () => {
    const result = run("disabled");
    expect(result.calls).toEqual(["healthy", "stalled", "health-503"]);
    expect(Object.keys(JSON.parse(result.stdout))).toEqual(["healthy", "stalled", "health-503"]);
    expect(result.receiptCount).toBe(0);
    expect(result.failure).toBeNull();
  });
  it("A02 enabled entry point reports the actual stalled call once without changing stdout or outcome", () => {
    const result = run("enabled");
    expect(result.calls).toEqual(["healthy", "stalled", "health-503"]);
    expect(result.stdout).toBe(run("disabled").stdout);
    expect(result.decoration).toEqual({ active: false, entries: 1, exits: 1, calls: [
      { case: "healthy", active: false }, { case: "stalled", active: true },
      { case: "health-503", active: false },
    ] });
    expect(result.receiptCount).toBe(1);
    expect(result.receipt).toMatchObject({ diagnosticOnly: true, actualInvocation: true,
      case: "stalled", measurementComplete: true, outcome: {
        counts: { nativeCalls: 21, nativeStatuses: 21, completedExits: 20, returnedExits: 20 },
        flags: { withinDeadline: false, exitsAgree: false },
      }, conditions: { nativeCallsExpected: 21, supervisorSeconds: 6, outerSeconds: 25,
        curlMaxAndConnectSeconds: 0.1, retries: 0, readinessLoops: 20 } });
  });
  it("A03 finally retains partial evidence and rethrows the original observation failure", () => {
    const result = run("exception");
    expect(result.calls).toEqual(["healthy", "stalled"]);
    expect(result.failure).toBe(true);
    expect(result.stdout).toBe("");
    expect(result.receiptCount).toBe(1);
    expect(result.receipt).toMatchObject({ measurementComplete: false, failureClass: "RuntimeError" });
    expect(result.leaked).toBe(false);
  });
  it("A04 actual receipt binds current source bytes and excludes private environment and native paths", () => {
    const result = run("enabled");
    expect(result.sourceBound).toBe(true);
    expect(result.leaked).toBe(false);
  });
  it("A05 decoration correlates 21 native intervals and restores original objects without logging arguments", () => {
    const result = run("intervals");
    expect(result.calls).toBe(21);
    expect(result.restored).toBe(true);
    expect(result.report.objectsRestored).toBe(true);
    expect(result.leaked).toBe(false);
    const events = result.report.events.filter(event => event.phase === "native.communicate");
    expect(events).toHaveLength(21);
    for (const phase of ["bridge-recv", "bridge-validate", "native.spawn", "bridge-send"])
      expect(result.report.events.filter(event => event.phase === phase)).toHaveLength(21);
    expect(new Set(events.map(event => event.requestId)).size).toBe(21);
    for (const event of events) {
      const spawn = result.report.events.find(candidate => candidate.phase === "native.spawn" && candidate.requestId === event.requestId);
      const sent = result.report.events.find(candidate => candidate.phase === "bridge-send" && candidate.requestId === event.requestId);
      const received = result.report.events.find(candidate => candidate.phase === "bridge-recv" && candidate.requestId === event.requestId);
      const validated = result.report.events.find(candidate => candidate.phase === "bridge-validate" && candidate.requestId === event.requestId);
      expect(spawn).toBeDefined();
      expect(sent).toBeDefined();
      expect(received).toBeDefined();
      expect(validated).toBeDefined();
      expect(received!.calls).toBeGreaterThan(0);
      expect(received!.bytes).toBeGreaterThan(0);
      for (const interval of [received!, validated!, spawn!, event, sent!]) {
        expect(Number.isSafeInteger(interval.startMonotonicNs)).toBe(true);
        expect(interval.endMonotonicNs).toBeGreaterThanOrEqual(interval.startMonotonicNs);
      }
      expect(validated!.startMonotonicNs).toBeGreaterThanOrEqual(received!.endMonotonicNs);
      expect(spawn!.startMonotonicNs).toBeGreaterThanOrEqual(validated!.endMonotonicNs);
      expect(Number.isSafeInteger(event.startMonotonicNs)).toBe(true);
      expect(event.endMonotonicNs).toBeGreaterThanOrEqual(event.startMonotonicNs);
      expect(event.startMonotonicNs).toBeGreaterThanOrEqual(spawn!.endMonotonicNs);
      expect(sent!.startMonotonicNs).toBeGreaterThanOrEqual(event.endMonotonicNs);
    }
  });
  it.each(["missing", "malformed", "partial"])("A06 rejects %s actual receipts as infrastructure evidence", kind => {
    const result = run(`validate-${kind}`);
    expect(result.available).toBe(true);
    expect(result.rejected).toBe(true);
  });
  it("A07 complete diagnostic evidence retains a failed oracle outcome without becoming acceptance", () => {
    const result = run("validate-valid");
    expect(result.available).toBe(true);
    expect(result.rejected).toBe(false);
  });
  it("A08 interrupted native communication retains partial measurement and restores objects", () => {
    const result = run("intervals-exception");
    expect(result.failure).toBe(true);
    expect(result.calls).toBe(1);
    expect(result.restored).toBe(true);
    expect(result.report.objectsRestored).toBe(true);
    expect(result.report.events.filter(event => event.phase === "native.communicate")).toHaveLength(1);
    expect(result.leaked).toBe(false);
  });
});
