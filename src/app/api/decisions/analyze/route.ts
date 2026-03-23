import { NextRequest } from 'next/server'
import { streamLLM, callLLM, getEngineConfig } from '@/lib/ai/engine'
import { ADVISOR_PROMPTS, COLLISION_PROMPT } from '@/lib/ai/prompts'
import { ADVISORS } from '@/types/decision'
import type { AdvisorName } from '@/types/decision'

export const maxDuration = 300

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

  // Build context — include core question, system-extracted facts, and probe Q&A
  let context = `核心决策问题：${diagnosis.coreQuestion}\n\n用户原始描述：\n${input}\n`

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
