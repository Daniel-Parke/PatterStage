# PatterStage — integration test harness (install/update scripts inside Docker)
# Used by tests/integration/test_full_install_update_process.py — not for production deploy.
FROM node:20-bookworm-slim
# Hermes upstream installer (uv + pip) compiles some wheels; root installs use /usr/local/bin/hermes.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        git \
        bash \
        curl \
        ca-certificates \
        procps \
        sudo \
        build-essential \
        python3 \
        python3-dev \
        python3-venv \
        libffi-dev \
        bsdextrautils \
        expect \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /workspace
ENV DEBIAN_FRONTEND=noninteractive
