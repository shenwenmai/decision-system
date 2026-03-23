-- ============================================================
-- Phase 1: User Profile System
-- 在 Supabase SQL Editor 里运行这段
-- ============================================================

-- 1. 用户画像主表
CREATE TABLE IF NOT EXISTS user_profiles (
  user_id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  decision_count  INTEGER     DEFAULT 0,

  -- 风险偏好：-1.0 极保守 → 0 中性 → +1.0 极激进
  risk_appetite   FLOAT       DEFAULT 0,

  -- 决策域分布：{"职业": 3, "关系": 1, "财务": 2, "创业": 0}
  domain_dist     JSONB       DEFAULT '{}',

  -- 反复出现的认知偏差（最多保留 top 5）
  recurring_biases TEXT[]     DEFAULT '{}',

  -- 最近 20 条的原始信号（滚动窗口）
  raw_signals     JSONB       DEFAULT '[]',

  -- LLM 生成的「决策 DNA」摘要，每 3 条决策更新一次
  style_summary   TEXT,

  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 2. RLS：只有本人可读写
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_profiles_self" ON user_profiles;
CREATE POLICY "user_profiles_self" ON user_profiles
  USING      (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- Phase 2 预留：向量相似度检索
-- （等 Voyage API Key 拿到后再跑这段）
-- ============================================================

-- CREATE EXTENSION IF NOT EXISTS vector;
-- ALTER TABLE decisions ADD COLUMN IF NOT EXISTS embedding vector(1024);
-- CREATE INDEX IF NOT EXISTS decisions_embedding_idx
--   ON decisions USING ivfflat (embedding vector_cosine_ops)
--   WITH (lists = 100);
