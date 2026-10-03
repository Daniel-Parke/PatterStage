"""Owned real-curl transport for the release-install HTTP fixture prototype."""
from __future__ import annotations
import hashlib
import json
import os
from pathlib import Path
import re
import secrets
import socket
import socketserver
import subprocess
import sys
import threading
import uuid
from urllib.parse import urlsplit


class CurlBridge:
    def __init__(self, fixture: Path, http_port: int, environment: dict, bash: str):
        self.fixture, self.http_port, self.environment = fixture, http_port, environment
        self.git_root = Path(bash).resolve().parents[1] if os.name == 'nt' else None
        self.key = secrets.token_hex(16)
        self.active, self.children = set(), []
        self.connections, self.workers = set(), set()
        self.lock, self.stopping = threading.Lock(), threading.Event()
        self.launch_environment = self.launch_cwd = self.client = self.output_argument = None
        self.calls, self.errors, self.clients, self.statuses, self.cancelled = 0, 0, {}, [], 0
        bridge = self

        class Handler(socketserver.BaseRequestHandler):
            def handle(self):
                with bridge.lock:
                    if bridge.stopping.is_set():
                        return
                    bridge.connections.add(self.request)
                    bridge.workers.add(threading.current_thread())
                try:
                    self.request.settimeout(25)
                    def field():
                        data = bytearray()
                        while len(data) < 8192:
                            value = self.request.recv(1)
                            if not value:
                                raise ValueError('truncated-frame')
                            if value == b'\0':
                                return data.decode('utf-8')
                            data.extend(value)
                        raise ValueError('oversize-frame')
                    magic = field()
                    if field() != bridge.key:
                        raise ValueError('invalid-key')
                    if magic == 'REGISTER':
                        size = field()
                        if not size.isdecimal() or not 0 < int(size) <= 1024 * 1024:
                            raise ValueError('invalid-environment-size')
                        payload = bytearray()
                        while len(payload) < int(size):
                            part = self.request.recv(int(size) - len(payload))
                            if not part:
                                raise ValueError('truncated-environment')
                            payload.extend(part)
                        bridge.register(json.loads(payload))
                        self.request.sendall(b'OK\0')
                        return
                    if magic != 'T0202':
                        raise ValueError('invalid-magic')
                    count = field()
                    if not count.isdecimal() or not 1 <= int(count) <= 40:
                        raise ValueError('invalid-argc')
                    executable, arguments = bridge.validate(field(), [field() for _ in range(int(count))])
                    with bridge.lock:
                        if bridge.stopping.is_set():
                            return
                        if bridge.launch_environment is None:
                            raise ValueError('unregistered-environment')
                        process = subprocess.Popen([str(executable), *arguments], env=bridge.launch_environment, cwd=bridge.launch_cwd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
                        bridge.active.add(process)
                        bridge.children.append(process)
                        bridge.calls += 1
                        bridge.clients[str(executable)] = hashlib.sha256(executable.read_bytes()).hexdigest()
                    try:
                        output, errors = process.communicate()
                        code = process.returncode
                        if bridge.stopping.is_set():
                            return
                        if b'\0' in output or b'\0' in errors or len(output) + len(errors) > 65536 or not 0 <= code <= 255:
                            raise ValueError('unsupported-response')
                        with bridge.lock:
                            bridge.statuses.append(code)
                        self.request.sendall(b'OK\0' + str(code).encode() + b'\0' + output + b'\0' + errors + b'\0')
                    finally:
                        with bridge.lock:
                            bridge.active.discard(process)
                except (BrokenPipeError, ConnectionResetError):
                    if not bridge.stopping.is_set():
                        bridge.fail()
                except Exception:
                    if not bridge.stopping.is_set():
                        bridge.fail()
                        try:
                            self.request.sendall(b'ERROR\0')
                        except OSError:
                            pass
                finally:
                    with bridge.lock:
                        bridge.connections.discard(self.request)
                        bridge.workers.discard(threading.current_thread())
        class Server(socketserver.ThreadingTCPServer):
            daemon_threads = True
            block_on_close = False
        self.server = Server(('127.0.0.1', 0), Handler)
        self.port = self.server.server_address[1]
        self.thread = threading.Thread(target=self.server.serve_forever, kwargs={'poll_interval': 0.01}, daemon=True)

    def fail(self):
        with self.lock:
            self.errors += 1
            with (self.fixture / 'fixture-error').open('a') as marker:
                marker.write('rpc-infrastructure\n')

    def executable(self, client):
        if os.name == 'nt':
            choices = {'/mingw64/bin/curl': self.git_root / 'mingw64/bin/curl.exe', '/mingw64/bin/curl.exe': self.git_root / 'mingw64/bin/curl.exe'}
            system = Path(os.environ['SystemRoot']) / 'System32/curl.exe'
            system_shell = '/' + system.as_posix()[0].lower() + system.as_posix()[2:]
            choices[system_shell] = system
            choices[system_shell[:-4]] = system
            executable = next((path for name, path in choices.items() if name.lower() == client.lower()), None)
        else:
            executable = Path('/usr/bin/curl') if client in ('/usr/bin/curl', '/bin/curl') else None
        if executable is None or not executable.is_file():
            raise ValueError('invalid-client')
        return executable

    def register(self, record):
        environment, cwd, client, arguments = (record.get(name) for name in ('environment', 'cwd', 'client', 'arguments'))
        if not isinstance(environment, dict) or not all(isinstance(k, str) and isinstance(v, str) and '\0' not in k + v for k, v in environment.items()):
            raise ValueError('invalid-environment')
        if not isinstance(cwd, str) or not isinstance(client, str) or not isinstance(arguments, list):
            raise ValueError('invalid-registration')
        selected = Path(client)
        if os.name == 'nt' and not selected.is_file():
            selected = Path(str(selected) + '.exe')
        allowed = [self.git_root / 'mingw64/bin/curl.exe', Path(os.environ['SystemRoot']) / 'System32/curl.exe'] if os.name == 'nt' else [Path('/usr/bin/curl')]
        actual = next((path for path in allowed if path.is_file() and selected.is_file() and selected.samefile(path)), None)
        if actual is None or not Path(cwd).resolve().is_relative_to(self.fixture.resolve()):
            raise ValueError('unowned-registration')
        output = None
        for index, argument in enumerate(arguments):
            if argument in ('-o', '--output') and index + 1 < len(arguments):
                output = arguments[index + 1]
            elif isinstance(argument, str) and argument.startswith('--output='):
                output = argument.split('=', 1)[1]
        if output not in ('/dev/null', 'nul', 'NUL'):
            raise ValueError('invalid-native-output')
        with self.lock:
            if self.launch_environment is not None or self.stopping.is_set():
                raise ValueError('duplicate-registration')
            self.launch_environment, self.launch_cwd = environment, cwd
            self.client, self.output_argument = actual, output
            (self.fixture / 'rpc-ready').write_text('ready\n')

    def validate(self, client, arguments):
        executable = self.executable(client)
        if self.client is not None and not executable.samefile(self.client):
            raise ValueError('changed-client')
        native, urls, index = [], [], 0
        flags = {'-s', '-S', '-sS', '--silent', '--show-error', '-f', '--fail', '-L', '--location'}
        valued = {'--connect-timeout', '--max-time', '-m', '-o', '--output', '-w', '--write-out', '-H', '--header', '--noproxy'}
        while index < len(arguments):
            arg = arguments[index]
            if arg in flags:
                native.append(arg)
            elif arg in valued or ('=' in arg and arg.split('=', 1)[0] in valued):
                if '=' in arg:
                    option, value = arg.split('=', 1)
                    inline = True
                else:
                    option = arg
                    index += 1
                    if index >= len(arguments):
                        raise ValueError('missing-option-value')
                    value, inline = arguments[index], False
                if option in ('--connect-timeout', '--max-time', '-m'):
                    if not re.fullmatch(r'[0-9]+(?:\.[0-9]+)?', value):
                        raise ValueError('invalid-time')
                elif option in ('-o', '--output'):
                    if value not in ('/dev/null', 'NUL', 'nul'):
                        raise ValueError('invalid-output')
                    value = self.output_argument or os.devnull
                elif option in ('-w', '--write-out'):
                    if value != '%{http_code}':
                        raise ValueError('invalid-write-out')
                elif option in ('-H', '--header'):
                    if not re.fullmatch(r'Authorization: Bearer [A-Za-z0-9._-]{1,256}', value):
                        raise ValueError('invalid-header')
                elif value != '*':
                    raise ValueError('invalid-noproxy')
                native.extend([option + '=' + value] if inline else [option, value])
            else:
                parsed = urlsplit(arg)
                if parsed.scheme != 'http' or parsed.hostname != '127.0.0.1' or parsed.port != self.http_port or parsed.username or parsed.password or parsed.query or parsed.fragment or parsed.path not in ('/', '/api/health', '/redirect-target'):
                    raise ValueError('invalid-owned-target')
                urls.append(arg)
                native.append(arg)
            index += 1
        if len(urls) != 1:
            raise ValueError('invalid-target-count')
        return executable, native

    def __enter__(self):
        self.thread.start()
        return self

    def __exit__(self, *_):
        with self.lock:
            self.stopping.set()
            owned = list(self.active)
            connections, workers = list(self.connections), list(self.workers)
        for connection in connections:
            try:
                connection.shutdown(socket.SHUT_RDWR)
            except OSError:
                pass
            connection.close()
        self.server.shutdown()
        for process in owned:
            if process.poll() is None:
                self.cancelled += 1
                process.terminate()
            try:
                process.wait(timeout=0.5)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait(timeout=0.5)
        self.server.server_close()
        self.thread.join(timeout=2)
        for worker in workers:
            worker.join(timeout=2)
        stopped = all(process.poll() is not None for process in self.children)
        listener_stopped = not self.thread.is_alive()
        ipc_stopped = all(not worker.is_alive() for worker in workers)
        audit = os.environ.get('T0202_RPC_AUDIT_DIR')
        if audit:
            row = {'case': self.environment.get('T0202_CASE'), 'calls': self.calls, 'errors': self.errors, 'clients': self.clients, 'statuses': self.statuses, 'cancelled': self.cancelled, 'ownedCurlStopped': stopped, 'listenerStopped': listener_stopped, 'ipcStopped': ipc_stopped, 'environmentRegistered': self.launch_environment is not None}
            path = Path(audit)
            path.mkdir(parents=True, exist_ok=True)
            with (path / (str(row['case']) + '-' + uuid.uuid4().hex + '.json')).open('x') as output:
                json.dump(row, output)
        if not stopped or not listener_stopped or not ipc_stopped:
            raise RuntimeError('Curl bridge cleanup failed')


def register_native():
    environment = dict(os.environ)
    environment['_'] = environment['T0202_RPC_CLIENT']
    record = {'environment': environment, 'cwd': os.getcwd(), 'client': sys.argv[3], 'arguments': sys.argv[4:]}
    payload = json.dumps(record).encode()
    with socket.create_connection(('127.0.0.1', int(sys.argv[2])), timeout=25) as connection:
        connection.sendall(b'REGISTER\0' + environment['T0202_RPC_KEY'].encode() + b'\0' + str(len(payload)).encode() + b'\0' + payload)
        response = bytearray()
        while len(response) < 32:
            value = connection.recv(1)
            if not value or value == b'\0':
                break
            response.extend(value)
        if response != b'OK':
            raise RuntimeError('Native curl registration failed')


if __name__ == '__main__':
    try:
        if len(sys.argv) < 4 or sys.argv[1] != '--register':
            raise ValueError('invalid-registration-launch')
        register_native()
    except Exception:
        sys.exit(90)
