#!/usr/bin/env python3
"""
Hindsight server — containerized entrypoint.

Unlike scripts/bootstrap/hindsight-server.py (which runs on the host against the
Hermes agent venv), this variant ships the `hindsight-all` package in the image
and reads every connection detail from the environment, so it runs the same on
Linux, macOS, and Windows under Docker. Binds 0.0.0.0 so the host can reach it
on the published port.
"""
import os
import signal
import sys

from hindsight import start_server


def main():
    server = start_server(
        db_url=os.environ.get(
            "HINDSIGHT_DB_URL",
            "postgresql://hindsight_user:hindsight_local@db:5432/hindsight_db",
        ),
        llm_provider=os.environ.get("HINDSIGHT_LLM_PROVIDER", "openai"),
        llm_api_key=os.environ.get("HINDSIGHT_LLM_API_KEY", ""),
        llm_model=os.environ.get("HINDSIGHT_LLM_MODEL", "xiaomi/mimo-v2-pro"),
        # On the host the gateway is http://localhost:8642; from a container use
        # host.docker.internal so it reaches the Hermes gateway running on the host.
        llm_base_url=os.environ.get("HINDSIGHT_LLM_BASE_URL", "http://host.docker.internal:8642/v1"),
        host="0.0.0.0",
        port=int(os.environ.get("HINDSIGHT_PORT", "9177")),
        log_level="info",
        timeout=120,
    )
    print(f"Hindsight server running at {server.url}", flush=True)

    def shutdown(_sig, _frame):
        print("Shutting down Hindsight server...", flush=True)
        server.stop()
        sys.exit(0)

    signal.signal(signal.SIGINT, shutdown)
    signal.signal(signal.SIGTERM, shutdown)
    signal.pause()


if __name__ == "__main__":
    main()
