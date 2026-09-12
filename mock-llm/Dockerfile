# Mock OpenAI-compatible LLM — lets a real Hermes Agent complete runs with no
# API keys/cost. Point Hermes' model.base_url at http://mock-llm:8000/v1.
FROM node:20-bookworm-slim
WORKDIR /app
COPY mock-llm/server.mjs ./server.mjs
ENV MOCK_LLM_PORT=8000
ENV MOCK_LLM_HOST=0.0.0.0
EXPOSE 8000
HEALTHCHECK --interval=10s --timeout=3s --start-period=3s --retries=5 \
  CMD node -e "require('http').get('http://127.0.0.1:'+(process.env.MOCK_LLM_PORT||8000)+'/health',(r)=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"
CMD ["node", "server.mjs"]
