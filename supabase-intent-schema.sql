-- 追踪系统 T+0：意向记录字段
-- 在 Supabase SQL Editor 中执行此文件

ALTER TABLE decisions
  ADD COLUMN IF NOT EXISTS intent TEXT CHECK (intent IN ('adopted', 'partial', 'deferred', 'reversed')),
  ADD COLUMN IF NOT EXISTS intent_note TEXT,
  ADD COLUMN IF NOT EXISTS intent_at TIMESTAMPTZ;

-- intent 取值说明：
--   adopted  = 采纳顾问建议
--   partial  = 部分采纳（有修改）
--   deferred = 暂时搁置
--   reversed = 反向而行
