/**
 * User Profile Engine
 *
 * 每次 verdict 落笔后：
 *   1. 从决策中提取结构化信号
 *   2. 累积进 user_profiles 表
 *   3. 每 3 条决策重新生成 style_summary（「决策 DNA」）
 *
 * 这是「越用越懂你」的核心机制。
 */

import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// ── 信号结构 ─────────────────────────────────────────────────────────────────

export interface DecisionSignal {
  domain: '职业' | '关系' | '财务' | '创业' | '生活' | '其他'
  risk_level: -2 | -1 | 0 | 1 | 2   // -2极保守 → +2极激进
  bias: string | null                 // 如 "损失厌恶" "现状偏见" null=未检测到
  direction: 'proactive' | 'conservative' | 'deferred' | 'unclear'
  key_factors: string[]               // 最终决策最看重的 1-2 个因素
  extracted_at: string
}

// ── 从单条决策提取信号 ─────────────────────────────────────────────────────

const SIGNAL_PROMPT = `你是一个决策行为分析器。分析用户的决策，提取结构化信号。
只返回JSON，不要任何解释。

输出格式：
{
  "domain": "职业|关系|财务|创业|生活|其他",
  "risk_level": -2到+2的整数（-2=极保守选择，0=中性，+2=极激进选择），
  "bias": "检测到的主要认知偏差名称，如「损失厌恶」「现状偏见」「过度自信」等，没有明显偏差则返回null",
  "direction": "proactive（主动出击）| conservative（保守稳健）| deferred（推迟决定）| unclear（未明确）",
  "key_factors": ["用户最终决策最看重的1-2个因素，用简短词语"]
}`

export async function extractSignal(
  coreQuestion: string,
  input: string,
  verdict: string,
): Promise<DecisionSignal | null> {
  try {
    const userMsg = `核心决策：${coreQuestion}\n\n用户背景：${input.slice(0, 400)}\n\n最终判断：${verdict.slice(0, 200)}`
    const raw = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      system: SIGNAL_PROMPT,
      messages: [{ role: 'user', content: userMsg }],
    })
    const text = raw.content[0].type === 'text' ? raw.content[0].text : ''
    const json = text.match(/\{[\s\S]*\}/)
    if (!json) return null
    return { ...JSON.parse(json[0]), extracted_at: new Date().toISOString() }
  } catch {
    return null
  }
}

// ── 生成「决策 DNA」摘要 ──────────────────────────────────────────────────────

const SUMMARY_PROMPT = `你是一个了解用户决策模式的分析师。
根据用户的历史决策信号，生成一段简洁的「决策DNA」描述。

要求：
- 150字以内，直接描述，不要标题
- 用第三人称客观描述（"该用户..."）
- 重点：风险偏好、决策域、反复的思维模式、决策时最看重什么
- 避免空洞，用具体行为特征说话`

export async function generateStyleSummary(
  signals: DecisionSignal[],
  existingSummary: string | null,
): Promise<string> {
  try {
    const signalText = signals.slice(-10).map((s, i) =>
      `${i + 1}. 域:${s.domain} 风险:${s.risk_level > 0 ? '+' : ''}${s.risk_level} 方向:${s.direction} 偏差:${s.bias ?? '无'} 看重:${s.key_factors.join('、')}`
    ).join('\n')

    const context = existingSummary
      ? `现有画像：${existingSummary}\n\n最新决策信号：\n${signalText}\n\n请更新画像，融合新信号：`
      : `决策信号列表：\n${signalText}\n\n请生成画像：`

    const raw = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      system: SUMMARY_PROMPT,
      messages: [{ role: 'user', content: context }],
    })
    return raw.content[0].type === 'text' ? raw.content[0].text.trim() : ''
  } catch {
    return existingSummary ?? ''
  }
}

// ── 将信号写入并更新 user_profiles ─────────────────────────────────────────

import { createClient as createServerClient } from '@supabase/supabase-js'

export async function updateUserProfile(
  userId: string,
  signal: DecisionSignal,
): Promise<void> {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )

  // 1. 拉出当前画像
  const { data: existing } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('user_id', userId)
    .single()

  const prev = existing as {
    decision_count: number
    risk_appetite: number
    domain_dist: Record<string, number>
    recurring_biases: string[]
    raw_signals: DecisionSignal[]
    style_summary: string | null
  } | null

  // 2. 计算新值
  const count = (prev?.decision_count ?? 0) + 1

  // 风险偏好：移动平均，新信号权重 0.3
  const prevRisk = prev?.risk_appetite ?? 0
  const newRisk = parseFloat((prevRisk * 0.7 + (signal.risk_level / 2) * 0.3).toFixed(3))

  // 域分布
  const domainDist = { ...(prev?.domain_dist ?? {}) }
  domainDist[signal.domain] = (domainDist[signal.domain] ?? 0) + 1

  // 偏差：滚动统计，保留 top 5
  const biasHistory = [...(prev?.raw_signals ?? []), signal]
    .filter(s => s.bias)
    .map(s => s.bias as string)
  const biasCounts: Record<string, number> = {}
  biasHistory.forEach(b => { biasCounts[b] = (biasCounts[b] ?? 0) + 1 })
  const topBiases = Object.entries(biasCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([b]) => b)

  // 信号滚动窗口（保留最近 20 条）
  const rawSignals = [...(prev?.raw_signals ?? []), signal].slice(-20)

  // 3. 每 3 条决策重新生成 style_summary
  let styleSummary = prev?.style_summary ?? null
  if (count % 3 === 0 || count === 1) {
    styleSummary = await generateStyleSummary(rawSignals, styleSummary)
  }

  // 4. Upsert
  await supabase.from('user_profiles').upsert({
    user_id: userId,
    decision_count: count,
    risk_appetite: newRisk,
    domain_dist: domainDist,
    recurring_biases: topBiases,
    raw_signals: rawSignals,
    style_summary: styleSummary,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' })
}
