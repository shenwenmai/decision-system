import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

interface AdvisorStatement {
  advisor: string
  displayName: string
  content: string
  veto: boolean
}

interface ExportRequest {
  coreQuestion: string
  originalInput: string
  advisorStatements: AdvisorStatement[]
  collisionContent: string
  verdict?: string
  followUpSummary?: string // brief summary of follow-up if any
}

export async function POST(req: NextRequest) {
  try {
    const body: ExportRequest = await req.json()
    const { coreQuestion, originalInput, advisorStatements, collisionContent, verdict, followUpSummary } = body

    const advisorContent = advisorStatements
      .filter(s => s.content?.trim())
      .map(s => `【${s.displayName}${s.veto ? '（否决）' : ''}】\n${s.content.slice(0, 600)}`)
      .join('\n\n')

    const systemPrompt = `你是一位顾问助理，负责将一场顾问圆桌讨论整理成简洁的行动方案文档。
输出 JSON 格式，字段如下：
{
  "summary": "2-3句话概括这个决策的核心",
  "keyInsights": [
    { "advisor": "顾问名", "insight": "这位顾问最关键的一个洞察，1-2句" }
  ],
  "actionSteps": [
    "具体可执行的行动步骤，动词开头，2-4条"
  ],
  "risks": "主要风险或注意事项，1-2句（如果有否决意见要特别提示）",
  "timeframe": "建议的决策/行动时间窗口（如有明确信息）"
}
只输出 JSON，不要任何其他内容。`

    const userPrompt = `决策问题：${coreQuestion}

用户原始描述：${originalInput.slice(0, 400)}

顾问观点摘要：
${advisorContent}

碰撞与合议结论：
${collisionContent.slice(0, 800)}

${verdict ? `用户已记录的决定：${verdict}` : '（用户尚未记录最终决定）'}

${followUpSummary ? `追问要点：${followUpSummary}` : ''}`

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    })

    const raw = message.content[0].type === 'text' ? message.content[0].text : ''
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON in response')

    // 清洗：替换中文引号、移除 JSON 字符串内的裸换行（常见 AI 输出问题）
    let cleaned = jsonMatch[0]
      .replace(/[\u201c\u201d]/g, '"')   // " " → "
      .replace(/[\u2018\u2019]/g, "'")   // ' ' → '
      // 将字符串值内的裸换行替换为 \n，避免 JSON.parse 报错
      .replace(/"((?:[^"\\]|\\.)*)"/g, (_, inner) =>
        '"' + inner.replace(/\n/g, '\\n').replace(/\r/g, '') + '"'
      )

    let actionPlan: unknown
    try {
      actionPlan = JSON.parse(cleaned)
    } catch {
      // 兜底：再尝试截断到最后一个完整字段
      const lastBrace = cleaned.lastIndexOf('}')
      actionPlan = JSON.parse(cleaned.slice(0, lastBrace + 1))
    }

    return NextResponse.json({ ok: true, actionPlan })
  } catch (err) {
    console.error('[export] error:', err)
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
  }
}
