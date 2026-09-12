# Mock Hermes API Server — a zero-dependency stand-in for end-to-end testing
# PatterStage without a real agent, models, or API keys. Swap for a real
# `hermes gateway` (API_SERVER_ENABLED=true) by pointing HERMES_GATEWAY_URL
# at it and removing this service from docker-compose.
FROM node:20-bookworm-slim
WORKDIR /app
COPY mock-hermes/server.mjs ./server.mjs
ENV API_SERVER_PORT=8642
ENV API_SERVER_HOST=0.0.0.0
EXPOSE 8642
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=5 \
  CMD node -e "require('http').get('http://127.0.0.1:'+(process.env.API_SERVER_PORT||8642)+'/health',(r)=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"
CMD ["node", "server.mjs"]
