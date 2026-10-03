-- Enable pgvector in the Hindsight database (runs once at first container init).
CREATE EXTENSION IF NOT EXISTS vector;
