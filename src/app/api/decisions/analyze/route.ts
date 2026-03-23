import { NextRequest } from 'next/server'
import { streamLLM, callLLM, getEngineConfig } from '@/lib/ai/engine'
import { ADVISOR_PROMPTS, COLLISION_PROMPT } from '@/lib/ai/prompts'
import { ADVISORS } from '@/types/decision'
import type { AdvisorName } from '@/types/decision'

export const maxDuration = 300

// ── 决策模式自动识别 ────────────────────────────────────────────────────────
// 根据已有的 diagnosis 字段自动选择决策算法，无需用户手动切换
// 三种模式本质不同：温柔=最小化心理损耗 / 理性=最大化期望收益 / 严厉=最小化决策错误
type DecisionMode = 'gentle' | 'rational' | 'strict'

function detectMode(diagnosis: { emotion?: string; trapDetected?: boolean }): DecisionMode {
  if (diagnosis.trapDetected) return 'strict'         // 检测到认知陷阱 → 偏差纠正
  if (diagnosis.emotion === '重') return 'gentle'     // 情绪负荷高 → 风险缓冲
  return 'rational'                                   // 默认 → 最优解引擎
}

const MODE_PREAMBLE: Record<DecisionMode, string> = {
  gentle: `
【当前决策算法：温柔·风险缓冲模式】
用户情绪负荷较高，决策能力暂时受限。本次分析请遵守以下算法优先级：
- 情绪稳定 > 决策最优；可逆性 > 收益最大化；风险规避 > 机会捕捉
- 优先推荐可逆、低压力的路径，而不是理论上最优但执行压力大的方案
- 在建议结尾加一句：「这是基于你当前状态的建议，不一定是长期最优解。」
- 不渲染风险，但不隐瞒关键约束`,

  rational: `
【当前决策算法：理性·最优解模式】
用户状态稳定，信息相对充足，适合做结构化分析。本次分析请遵守以下算法优先级：
- 明确列出所有可行选项及其概率与风险
- 给出明确的最优解推荐，不要模糊带过
- 在建议结尾加一句：「这个结论以理性执行为前提。」`,

  strict: `
【当前决策算法：严厉·偏差纠正模式】
系统检测到认知陷阱或高风险决策倾向。本次分析请遵守以下算法优先级：
- 直接指出偏差，不共情、不绕弯子
- 如有必要，明确否定用户当前的倾向，提出唯一建议或建议"暂不决策"
- 在建议结尾加一句：「你可以不接受，但这是基于分析逻辑的判断。」`,
}

const MODE_LABEL: Record<DecisionMode, { label: string; desc: string; color: string }> = {
  gentle:   { label: '温柔', desc: '风险缓冲·可逆优先', color: '#6b7280' },
  rational: { label: '理性', desc: '最优解·期望收益', color: '#2563eb' },
  strict:   { label: '严厉', desc: '偏差纠正·强制校准', color: '#dc2626' },
}

export async function POST(request: NextRequest) {
  const { input, diagnosis, probeAnswers, tier = 'free', byokConfig, outputMode = 'detailed', targetAdvisors, historyContext } = await request.json()

  const config = getEngineConfig(tier, byokConfig)
  // targetAdvisors overrides routing (used for @ mentions)
  const baseAdvisors: AdvisorName[] = (targetAdvisors && targetAdvisors.length > 0)
    ? targetAdvisors
    : diagnosis.activatedAdvisors

  // 「现实校准官」始终作为最后一位顾问注入，确保所有分析都有冷静校准层
  const advisors: AdvisorName[] = baseAdvisors.includes('reality')
    ? baseAdvisors
    : [...baseAdvisors, 'reality']

  // 自动识别决策模式
  const mode = detectMode(diagnosis)

  // Build context — include core question, system-extracted facts, and probe Q&A
  // 模式算法前置注入：让所有顾问共享同一套决策目标函数
  let context = MODE_PREAMBLE[mode] + `\n\n核心决策问题：${diagnosis.coreQuestion}\n\n用户原始描述：\n${input}\n`

  // Include system-extracted context summary (what advisors already know)
  if (diagnosis.contextSummary?.length > 0) {
    context += '\n系统已确认的关键事实：\n'
    diagnosis.contextSummary.forEach((fact: string) => {
      context += `· ${fact}\n`
    })
  }

  // Include user's decision history for continuity (if available)
  if (historyContext) {
    context += `\n${historyContext}\n`
  }

  // Include probe Q&A with actual question text (not just index keys)
  if (probeAnswers && diagnosis.probes?.length > 0) {
    const probeEntries = Object.entries(probeAnswers as Record<string, string>)
      .filter(([, value]) => value?.trim())
    if (probeEntries.length > 0) {
      context += '\n用户补充回答：\n'
      probeEntries.forEach(([key, value]) => {
        const idx = parseInt(key.replace('probe_', ''))
        const question = diagnosis.probes[idx] ?? key
        context += `Q：${question}\nA：${value}\n\n`
      })
    }
  }

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: object | string) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
      }

      try {
        // 首先推送当前决策模式元数据给客户端
        send('meta', { mode, modeLabel: MODE_LABEL[mode] })

        // Phase 1: Advisor statements
        const statements: { advisor: AdvisorName; content: string }[] = []

        for (const advisor of advisors) {
          send('advisor_start', { advisor })

          const prompt = ADVISOR_PROMPTS[advisor]
          if (!prompt) continue

          let fullContent = ''

          if (outputMode === 'detailed') {
            // Stream each advisor's response
            for await (const chunk of streamLLM(config, prompt, context)) {
              send('advisor_chunk', { advisor, chunk })
              fullContent += chunk
            }
          } else {
            // Concise mode: get full response, send summary
            fullContent = await callLLM(config, prompt + '\n\n请用3-5句话给出你的核心判断，不展开详细分析。', context)
            send('advisor_chunk', { advisor, chunk: fullContent })
          }

          // Veto detection: look for explicit veto signal markers from advisor prompts
          const veto = fullContent.includes('[否决:触发]') ||
            fullContent.includes('否决条件：触发') ||
            fullContent.includes('否决信号：是') ||
            (fullContent.includes('否决') && fullContent.includes('：是'))
          statements.push({ advisor, content: fullContent })
          send('advisor_done', { advisor, veto })
        }

        // Phase 2: Collision + Consensus
        send('phase', { phase: 'collision' })

        const statementsContext = statements
          .map(s => `【${ADVISORS[s.advisor]?.displayName ?? s.advisor}的陈述】\n${s.content}`)
          .join('\n\n---\n\n')

        const collisionInput = `${context}\n\n以下是各顾问的独立陈述：\n\n${statementsContext}`

        for await (const chunk of streamLLM(config, COLLISION_PROMPT, collisionInput)) {
          send('collision_chunk', { chunk })
        }

        send('phase', { phase: 'complete' })
      } catch (error) {
        send('error', { message: String(error) })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
