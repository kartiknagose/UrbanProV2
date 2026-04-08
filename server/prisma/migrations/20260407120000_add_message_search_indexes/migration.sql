-- Improve chat message retrieval and content search performance.
CREATE INDEX IF NOT EXISTS "Message_conversationId_createdAt_idx"
ON "Message"("conversationId", "createdAt");

-- Trigram index accelerates ILIKE / fuzzy text search on message content.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS "Message_content_trgm_idx"
ON "Message"
USING gin ("content" gin_trgm_ops);
