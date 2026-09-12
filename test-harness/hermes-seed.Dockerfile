# One-shot seed: populate the Hermes named volume (/opt/data = HERMES_HOME) with
# the test fixture, so the real Hermes container boots with our config + key.
# Using a build-context COPY (not a host bind mount) keeps it portable across
# Windows/Linux/CI. Runs once; hermes depends_on it (service_completed_successfully).
FROM alpine:3.20
COPY test-harness/hermes-home/ /seed/
CMD ["sh", "-c", "mkdir -p /opt/data && cp /seed/config.yaml /opt/data/config.yaml && cp /seed/hermes.env /opt/data/.env && echo '[hermes-seed] populated /opt/data' && ls -la /opt/data"]
