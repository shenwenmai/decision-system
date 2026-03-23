import { NextRequest, NextResponse } from 'next/server'
import { callLLM, getEngineConfig, extractImageContent } from '@/lib/ai/engine'
import { SYSTEM_PROMPT } from '@/lib/ai/prompts'
import type { Diagnosis } from '@/types/decision'

export async function POST(request: NextRequest) {
  try {
    const { input, tier = 'free', byokConfig, imageBase64, imageName } = await request.json()

    if (!input || input.trim().length === 0) {
      return NextResponse.json({ error: '请描述你的决策问题' }, { status: 400 })
    }

    const config = getEngineConfig(tier, byokConfig)

    // If image attached, extract its content via vision first
    let enrichedInput = input
    if (imageBase64) {
      const imageDesc = await extractImageContent(imageBase64)
      enrichedInput = `${input}\n\n【附件图片：${imageName || '截图'}】\n${imageDesc}`
    }

    // Step 1-4: Diagnosis (stage, emotion, trap, routing, probes)
    const diagnosisRaw = await callLLM(config, SYSTEM_PROMPT, enrichedInput)
    console.log('[diagnosis raw]', diagnosisRaw.slice(0, 600))

    let diagnosis: Diagnosis
    try {
      // Extract JSON — handle ```json ... ``` wrapping and bare JSON
      let jsonStr = diagnosisRaw
      const fenceMatch = diagnosisRaw.match(/```(?:json)?\s*([\s\S]*?)```/)
      if (fenceMatch) {
        jsonStr = fenceMatch[1]
      } else {
        const braceMatch = diagnosisRaw.match(/\{[\s\S]*\}/)
        if (!braceMatch) throw new Error('No JSON found')
        jsonStr = braceMatch[0]
      }
      diagnosis = JSON.parse(jsonStr)
      // 兜底：如果 Claude 没返回 seenMoment，用 coreQuestion 派生一个
      if (!diagnosis.seenMoment && diagnosis.coreQuestion) {
        diagnosis.seenMoment = `你现在真正在问的，是：${diagnosis.coreQuestion}`
      }
      console.log('[seenMoment]', diagnosis.seenMoment ?? '❌ 未返回')
    } catch (parseErr) {
      console.error('[diagnosis parse error]', parseErr, '\n[raw]', diagnosisRaw.slice(0, 400))
      // Fallback diagnosis if LLM doesn't return clean JSON
      const coreQ = input.slice(0, 100)
      diagnosis = {
        stage: '定义期',
        emotion: '中',
        trapDetected: false,
        coreQuestion: coreQ,
        seenMoment: `你现在真正在问的，是：${coreQ}`,
        activatedAdvisors: ['munger'],
        contextSummary: [],
        probes: ['你心里是偏向哪个方向？'],
        probeOptions: [['倾向做', '倾向不做', '还不确定']],
      }
    }

    const decisionId = crypto.randomUUID()

    return NextResponse.json({
      decisionId,
      diagnosis,
      enrichedInput,  // image-augmented input for client to store
      engineTier: tier,
      engineLabel: tier === 'byok' ? '自选引擎' : '旗舰引擎 · Claude',
    })
  } catch (error) {
    console.error('Decision creation error:', error)
    return NextResponse.json({ error: '系统处理出错，请重试' }, { status: 500 })
  }
}
