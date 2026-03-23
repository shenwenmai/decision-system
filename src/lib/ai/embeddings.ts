/**
 * Voyage AI Embedding Engine
 *
 * 使用 voyage-3 模型（1024 维）生成语义向量。
 * 为每条决策生成 embedding，存入 Supabase pgvector。
 * 新决策提交时，用向量相似度找到最相关的历史案例。
 *
 * 这是「越用越懂你」的检索层——不是找最近的，而是找最像的。
 */

const VOYAGE_API_URL = 'https://api.voyageai.com/v1/embeddings'
const VOYAGE_MODEL = 'voyage-3'           // 1024 维，质量与成本最优平衡

// ── 生成单条 embedding ────────────────────────────────────────────────────────

export async function generateEmbedding(text: string): Promise<number[] | null> {
  const key = process.env.VOYAGE_API_KEY
  if (!key) {
    console.warn('[embeddings] VOYAGE_API_KEY not set')
    return null
  }

  try {
    const res = await fetch(VOYAGE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`,
      },
      body: JSON.stringify({
        input: [text.slice(0, 4000)],   // Voyage 最大 token 限制
        model: VOYAGE_MODEL,
        input_type: 'document',         // 存储时用 document，查询时用 query
      }),
    })

    if (!res.ok) {
      console.error('[embeddings] Voyage API error', res.status, await res.text())
      return null
    }

    const data = await res.json()
    return data.data?.[0]?.embedding ?? null
  } catch (err) {
    console.error('[embeddings] generateEmbedding error', err)
    return null
  }
}

// ── 生成查询 embedding（语义搜索用） ──────────────────────────────────────────

export async function generateQueryEmbedding(text: string): Promise<number[] | null> {
  const key = process.env.VOYAGE_API_KEY
  if (!key) return null

  try {
    const res = await fetch(VOYAGE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`,
      },
      body: JSON.stringify({
        input: [text.slice(0, 2000)],
        model: VOYAGE_MODEL,
        input_type: 'query',            // 查询时用 query 类型，提升召回率
      }),
    })

    if (!res.ok) return null
    const data = await res.json()
    return data.data?.[0]?.embedding ?? null
  } catch {
    return null
  }
}

// ── 构建决策的 embedding 文本 ─────────────────────────────────────────────────
// 把核心问题 + 背景 + 最终判断拼在一起，让向量捕捉完整语义

export function buildDecisionText(
  coreQuestion: string,
  input: string,
  verdict?: string | null,
): string {
  const parts = [
    `决策核心：${coreQuestion}`,
    `背景：${input.slice(0, 500)}`,
    verdict ? `最终判断：${verdict.slice(0, 150)}` : '',
  ]
  return parts.filter(Boolean).join('\n')
}

// ── 语义相似决策检索 ──────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'

export interface SimilarDecision {
  id: string
  coreQuestion: string
  verdict: string | null
  similarity: number
}

export async function findSimilarDecisions(
  userId: string,
  queryText: string,
  limit = 3,
): Promise<SimilarDecision[]> {
  const queryEmbedding = await generateQueryEmbedding(queryText)
  if (!queryEmbedding) return []

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )

  // 使用 Supabase pgvector 的余弦相似度搜索
  const { data, error } = await supabase.rpc('match_decisions', {
    query_embedding: queryEmbedding,
    match_user_id: userId,
    match_count: limit,
    similarity_threshold: 0.65,   // 低于 0.65 的结果不返回（避免噪音）
  })

  if (error) {
    console.error('[embeddings] match_decisions error', error)
    return []
  }

  return (data ?? []).map((row: {
    id: string
    diagnosis: Record<string, unknown> | null
    verdict: string | null
    similarity: number
  }) => ({
    id: row.id,
    coreQuestion: (row.diagnosis as Record<string, unknown>)?.coreQuestion as string ?? '',
    verdict: row.verdict,
    similarity: row.similarity,
  }))
}
