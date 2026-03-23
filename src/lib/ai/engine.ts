import Anthropic from '@anthropic-ai/sdk'

type Tier = 'free' | 'pro' | 'byok'

interface EngineConfig {
  provider: 'anthropic' | 'deepseek' | 'openai'
  model: string
  apiKey: string
  baseURL?: string
}

export function getEngineConfig(tier: Tier, byokConfig?: { provider: string; model: string; apiKey: string }): EngineConfig {
  switch (tier) {
    case 'free':
      return {
        provider: 'anthropic',
        model: 'claude-sonnet-4-6',
        apiKey: process.env.ANTHROPIC_API_KEY || '',
      }
    case 'pro':
      return {
        provider: 'anthropic',
        model: 'claude-opus-4-6',   // 旗舰级，专业版专用
        apiKey: process.env.ANTHROPIC_API_KEY || '',
      }
    case 'byok':
      if (!byokConfig) throw new Error('BYOK requires user API config')
      return {
        provider: byokConfig.provider as EngineConfig['provider'],
        model: byokConfig.model,
        apiKey: byokConfig.apiKey,
        baseURL: byokConfig.provider === 'deepseek' ? 'https://api.deepseek.com' : undefined,
      }
  }
}

export async function callLLM(
  config: EngineConfig,
  systemPrompt: string,
  userMessage: string,
): Promise<string> {
  if (config.provider === 'anthropic') {
    const client = new Anthropic({ apiKey: config.apiKey })
    const response = await client.messages.create({
      model: config.model,
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    })
    return response.content[0].type === 'text' ? response.content[0].text : ''
  }

  // DeepSeek and OpenAI-compatible APIs
  const baseURL = config.baseURL || 'https://api.openai.com/v1'
  const response = await fetch(`${baseURL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      max_tokens: 4096,
      temperature: 0.7,
    }),
  })

  const data = await response.json()
  return data.choices?.[0]?.message?.content || ''
}

export async function* streamLLM(
  config: EngineConfig,
  systemPrompt: string,
  userMessage: string,
): AsyncGenerator<string> {
  if (config.provider === 'anthropic') {
    const client = new Anthropic({ apiKey: config.apiKey })
    const stream = client.messages.stream({
      model: config.model,
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    })

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        yield event.delta.text
      }
    }
    return
  }

  // DeepSeek and OpenAI-compatible streaming
  const baseURL = config.baseURL || 'https://api.openai.com/v1'
  const response = await fetch(`${baseURL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      max_tokens: 4096,
      temperature: 0.7,
      stream: true,
    }),
  })

  const reader = response.body?.getReader()
  const decoder = new TextDecoder()
  if (!reader) return

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    const chunk = decoder.decode(value)
    const lines = chunk.split('\n').filter(line => line.startsWith('data: '))

    for (const line of lines) {
      const data = line.slice(6)
      if (data === '[DONE]') return

      try {
        const parsed = JSON.parse(data)
        const content = parsed.choices?.[0]?.delta?.content
        if (content) yield content
      } catch {
        // skip malformed chunks
      }
    }
  }
}

/**
 * Extract text description from an image using Claude vision.
 * imageBase64 should be a data URL: "data:image/jpeg;base64,..."
 * Returns a text description suitable for inclusion in the decision context.
 */
export async function extractImageContent(imageBase64: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey || apiKey === 'your_anthropic_api_key_here') {
    return '[图片已上传，但视觉分析需要旗舰引擎。请在背景信息中手动描述图片内容。]'
  }

  const client = new Anthropic({ apiKey })

  // Parse data URL: "data:image/jpeg;base64,XXXX"
  const matches = imageBase64.match(/^data:([^;]+);base64,(.+)$/)
  if (!matches) return '[图片格式无法识别]'

  const mediaType = matches[1] as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'
  const base64Data = matches[2]

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image',
          source: { type: 'base64', media_type: mediaType, data: base64Data },
        },
        {
          type: 'text',
          text: '请用中文详细描述这张图片的内容。如果是截图（聊天记录、文件、表格、流程图等），请提取其中的关键信息和文字内容。输出纯文字，不需要格式标题，200字以内。',
        },
      ],
    }],
  })

  return response.content[0].type === 'text' ? response.content[0].text : '[图片内容提取失败]'
}

