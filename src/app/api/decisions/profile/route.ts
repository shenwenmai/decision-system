/**
 * POST /api/decisions/profile
 *
 * verdict 落笔后调用。同时做三件事：
 *   1. 提取决策信号（domain, risk, bias, direction）
 *   2. 生成 embedding → 存入 decisions.embedding（向量知识库）
 *   3. 更新 user_profiles（画像 + 风险偏好 + 偏差统计）
 *
 * 全部 fire-and-forget，失败不影响主流程。
 */

import { NextRequest, NextResponse } from 'next/server'
import { extractSignal, updateUserProfile } from '@/lib/ai/profile'
import { generateEmbedding, buildDecisionText } from '@/lib/ai/embeddings'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    const { userId, decisionId, coreQuestion, input, verdict } = await request.json()

    if (!userId || !decisionId || !verdict) {
      return NextResponse.json({ ok: false, reason: 'missing fields' }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )

    // 并行执行：信号提取 + embedding 生成（互不依赖）
    const [signal, embedding] = await Promise.all([
      extractSignal(coreQuestion ?? '', input ?? '', verdict),
      generateEmbedding(buildDecisionText(coreQuestion ?? '', input ?? '', verdict)),
    ])

    // 读出当前 analysis，准备追加 userSignal
    const { data: row } = await supabase
      .from('decisions')
      .select('analysis')
      .eq('id', decisionId)
      .single()
    const existingAnalysis = (row?.analysis as Record<string, unknown>) ?? {}

    // 写入 decisions：userSignal + embedding（并行）
    const updatePayload: Record<string, unknown> = {
      analysis: { ...existingAnalysis, userSignal: signal ?? null },
    }
    if (embedding) {
      // pgvector requires the array formatted as "[x1,x2,...]" — NOT JSON.stringify
      updatePayload.embedding = `[${embedding.join(',')}]`
    }

    await supabase
      .from('decisions')
      .update(updatePayload)
      .eq('id', decisionId)

    // 更新 user_profiles（含画像重生成）
    if (signal) {
      await updateUserProfile(userId, signal)
    }

    return NextResponse.json({
      ok: true,
      signal: signal ?? null,
      embeddingDims: embedding?.length ?? 0,
    })
  } catch (err) {
    console.error('[profile update error]', err)
    return NextResponse.json({ ok: false, reason: 'internal error' }, { status: 500 })
  }
}
