-- ============================================================
-- Phase 2: pgvector 向量知识库
-- 在 Supabase SQL Editor 里运行这段
-- 需要先确保 Phase 1 的 user_profiles 表已创建
-- ============================================================

-- 1. 启用 pgvector 扩展
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. 给 decisions 表加 embedding 列（voyage-3 是 1024 维）
ALTER TABLE decisions
  ADD COLUMN IF NOT EXISTS embedding vector(1024);

-- 3. 创建向量索引（ivfflat 适合中小规模，cosine 距离）
--    lists=100 适合 10 万条以内，之后可调大
CREATE INDEX IF NOT EXISTS decisions_embedding_idx
  ON decisions
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- 4. 核心检索函数：找到语义最相似的历史决策
--    只搜索同一用户 + 已有 embedding + 有 verdict 的决策
CREATE OR REPLACE FUNCTION match_decisions(
  query_embedding   vector(1024),
  match_user_id     uuid,
  match_count       int     DEFAULT 3,
  similarity_threshold float DEFAULT 0.65
)
RETURNS TABLE (
  id          uuid,
  diagnosis   jsonb,
  verdict     text,
  similarity  float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    d.id,
    d.diagnosis,
    d.verdict,
    1 - (d.embedding <=> query_embedding) AS similarity
  FROM decisions d
  WHERE
    d.user_id = match_user_id
    AND d.embedding IS NOT NULL
    AND d.verdict IS NOT NULL
    AND 1 - (d.embedding <=> query_embedding) > similarity_threshold
  ORDER BY d.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- 5. 给 match_decisions 设 RLS 绕过权限
--    （函数内部已经通过 user_id 过滤，安全）
GRANT EXECUTE ON FUNCTION match_decisions TO anon, authenticated;

-- ============================================================
-- Phase 1 SQL（如果还没跑，一起跑）
-- ============================================================

CREATE TABLE IF NOT EXISTS user_profiles (
  user_id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  decision_count  INTEGER     DEFAULT 0,
  risk_appetite   FLOAT       DEFAULT 0,
  domain_dist     JSONB       DEFAULT '{}',
  recurring_biases TEXT[]     DEFAULT '{}',
  raw_signals     JSONB       DEFAULT '[]',
  style_summary   TEXT,
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_profiles_self" ON user_profiles;
CREATE POLICY "user_profiles_self" ON user_profiles
  USING      (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
