#!/usr/bin/env python3
"""Independent Q015 observer: real native HTTP with a no-DNS resolver sentinel.

Delegate the existing fixture unchanged. Export only numeric listener metadata,
request classifications, native client hashes and ownership/cleanup outcomes.
The sentinel proves a resolver call path, not actual native DNS duration.
"""
from __future__ import annotations

import functools
import importlib.util
import json
import os
from pathlib import Path
import shutil
import socket
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, HTTPServer, ThreadingHTTPServer
from typing import Any

CASES = ("control", "healthy", "wrong-credential", "occupied-listener", "stubborn")
FIXTURE_PATH = Path(__file__).with_name("release-install-http-probe.py")


def load_fixture() -> Any:
    spec = importlib.util.spec_from_file_location("t0205_loopback_fixture", FIXTURE_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError("Cannot load HTTP fixture interface")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def calibrate_sentinel() -> dict[str, object]:
    """Exercise stdlib's real constructor while preventing external resolution."""
    original_fqdn, original_reverse = socket.getfqdn, socket.gethostbyaddr
    calls: list[str] = []
    external_attempts = 0

    def sentinel(name: str = "") -> str:
        calls.append(name)
        return name

    def forbidden_reverse(*_args: object) -> Any:
        nonlocal external_attempts
        external_attempts += 1
        raise RuntimeError("Sentinel must not perform DNS")

    try:
        socket.getfqdn, socket.gethostbyaddr = sentinel, forbidden_reverse
        direct = socket.getfqdn("127.0.0.1")
        direct_calls = len(calls)
        calls.clear()
        server = ThreadingHTTPServer(("127.0.0.1", 0), BaseHTTPRequestHandler)
        try:
            address = server.socket.getsockname()
            constructor_calls = list(calls)
        finally:
            server.server_close()
        closed = server.socket.fileno() == -1
    finally:
        socket.getfqdn, socket.gethostbyaddr = original_fqdn, original_reverse
    return {
        "directValue": direct, "directCalls": direct_calls,
        "constructorCalls": constructor_calls, "externalAttempts": external_attempts,
        "boundAddress": address[0], "boundPort": address[1], "socketClosed": closed,
        "restored": socket.getfqdn is original_fqdn and socket.gethostbyaddr is original_reverse,
    }


def observe(case: str, bash: str, *, fixture_override: Any = None) -> dict[str, object]:
    """Observe inherited HTTP construction, including direct subclass calls.

    A private fixture override permits labelled direct-constructor calibration.
    The normal CLI has no override and executes the tracked fixture unchanged.
    """
    fixture = load_fixture() if fixture_override is None else fixture_override
    original_constructor, original_bridge = fixture.ThreadingHTTPServer, fixture.CurlBridge
    original_init = HTTPServer.__init__
    init_was_local = "__init__" in HTTPServer.__dict__
    original_fqdn = socket.getfqdn
    resolver_calls: list[str] = []
    servers: list[Any] = []
    bridges: list[Any] = []
    listener_threads: list[threading.Thread] = []
    request_threads: list[int] = []
    metadata: list[dict[str, object]] = []
    handler_hooks: list[tuple[Any, Any]] = []
    serve_hooks: list[tuple[Any, Any, bool]] = []

    def sentinel(name: str = "") -> str:
        resolver_calls.append(name)
        return name

    @functools.wraps(original_init)
    def construct(server: Any, *args: Any, **kwargs: Any) -> None:
        requested = args[0] if args else kwargs["server_address"]
        handler = args[1] if len(args) > 1 else kwargs["RequestHandlerClass"]
        original_get = handler.do_GET

        @functools.wraps(original_get)
        def request(instance: Any) -> Any:
            request_threads.append(threading.get_ident())
            return original_get(instance)

        handler.do_GET = request
        handler_hooks.append((handler, original_get))
        # This inherited hook delegates construction, bind and activation intact.
        # It does not replace either fixture constructor symbol or server_bind.
        original_init(server, *args, **kwargs)
        servers.append(server)
        address = server.socket.getsockname()
        metadata.append({
            "requestedAddress": requested[0], "requestedPort": requested[1],
            "boundAddress": address[0], "boundPort": address[1],
            "serverAddress": list(server.server_address), "serverName": server.server_name,
            "className": type(server).__name__,
            "serverPort": server.server_port, "family": int(server.socket.family),
            "socketType": int(server.socket.type),
            "accepting": server.socket.getsockopt(socket.SOL_SOCKET, socket.SO_ACCEPTCONN) == 1,
            "reuseAddress": bool(server.socket.getsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR)),
        })
        original_serve = server.serve_forever
        serve_hooks.append((server, original_serve, "serve_forever" in server.__dict__))

        @functools.wraps(original_serve)
        def serve(*serve_args: Any, **serve_kwargs: Any) -> Any:
            listener_threads.append(threading.current_thread())
            return original_serve(*serve_args, **serve_kwargs)

        server.serve_forever = serve

    def bridge(*args: Any, **kwargs: Any) -> Any:
        transport = original_bridge(*args, **kwargs)
        bridges.append(transport)
        return transport

    started = time.monotonic()
    try:
        socket.getfqdn = sentinel
        HTTPServer.__init__, fixture.CurlBridge = construct, bridge
        outcome = fixture.run_case(case, bash)
    finally:
        if init_was_local:
            HTTPServer.__init__ = original_init
        else:
            del HTTPServer.__init__
        fixture.CurlBridge = original_bridge
        socket.getfqdn = original_fqdn
        for handler, original_get in reversed(handler_hooks):
            handler.do_GET = original_get
        for server, original_serve, was_local in reversed(serve_hooks):
            if was_local:
                server.serve_forever = original_serve
            else:
                del server.serve_forever
    native = [{
        "calls": transport.calls, "errors": transport.errors,
        "cancelled": transport.cancelled, "statuses": transport.statuses,
        "clientHashes": list(transport.clients.values()),
        "environmentRegistered": transport.launch_environment is not None,
        "ownedCurlStopped": all(child.poll() is not None for child in transport.children),
        "listenerStopped": not transport.thread.is_alive(),
        "ipcStopped": all(not worker.is_alive() for worker in transport.workers),
        "socketClosed": transport.server.socket.fileno() == -1,
    } for transport in bridges]
    return {
        **outcome, "resolverCalls": resolver_calls, "listeners": metadata, "native": native,
        "elapsedSeconds": time.monotonic() - started,
        "listenerSocketsClosed": bool(servers) and all(server.socket.fileno() == -1 for server in servers),
        "listenerThreadsStopped": bool(listener_threads) and all(not thread.is_alive() for thread in listener_threads),
        "requestsThreaded": bool(request_threads) and all(
            identity not in [thread.ident for thread in listener_threads] for identity in request_threads
        ),
        "restored": socket.getfqdn is original_fqdn
        and fixture.ThreadingHTTPServer is original_constructor and fixture.CurlBridge is original_bridge
        and HTTPServer.__init__ is original_init and ("__init__" in HTTPServer.__dict__) == init_was_local
        and all(handler.do_GET is original_get for handler, original_get in handler_hooks)
        and all(("serve_forever" in server.__dict__) == was_local for server, _, was_local in serve_hooks),
    }


def main() -> None:
    bash = os.environ.get("T0202_BASH") or ("C:/Program Files/Git/bin/bash.exe" if os.name == "nt" else shutil.which("bash"))
    if not bash:
        raise RuntimeError("Bash is required")
    if sys.argv[1:]:
        raise ValueError("Loopback observer accepts no production overrides")
    print(json.dumps({"calibration": calibrate_sentinel(), "cases": {
        case: observe(case, bash) for case in CASES
    }}))


if __name__ == "__main__":
    main()
