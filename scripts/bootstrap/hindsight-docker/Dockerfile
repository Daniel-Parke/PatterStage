# Cross-platform Hindsight memory server.
# Bundles the `hindsight-all` Python package so no host Python/venv is needed —
# the same package setup-hindsight.sh installs natively on Linux.
FROM python:3.12-slim

RUN pip install --no-cache-dir hindsight-all

COPY server.py /app/server.py
WORKDIR /app

EXPOSE 9177

CMD ["python", "server.py"]
