'use client'

import React, { useState, useRef, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'

// ─── Input quality signal ──────────────────────────────────────────────────

function getInputQuality(main: string, context: Record<string, string>): {
  level: 'empty' | 'thin' | 'ok' | 'good' | 'rich'
  label: string
  hint: string
  filledFields: number
} {
  const len = main.trim().length
  const filledFields = Object.values(context).filter(v => v.trim()).length

  if (len === 0) return { level: 'empty', label: '', hint: '', filledFields: 0 }
  if (len < 25) return {
    level: 'thin',
    label: '再多说几句',
    hint: '顾问需要更多信息才能给出有针对性的判断',
    filledFields,
  }
  if (len < 80) return {
    level: 'ok',
    label: filledFields > 0 ? '信息尚可' : '可以分析，但结论会比较泛',
    hint: '补充背景信息后分析会更有针对性',
    filledFields,
  }
  if (len < 200 || filledFields >= 2) return {
    level: 'good',
    label: '信息充足',
    hint: '顾问可以给出有针对性的判断了',
    filledFields,
  }
  return {
    level: 'rich',
    label: '信息完整',
    hint: '这个信息量能让顾问给出非常具体的建议',
    filledFields,
  }
}

const QUALITY_COLORS: Record<string, string> = {
  thin: 'bg-amber-300',
  ok: 'bg-amber-400',
  good: 'bg-emerald-500',
  rich: 'bg-emerald-600',
}

const QUALITY_WIDTH: Record<string, string> = {
  empty: 'w-0',
  thin: 'w-1/4',
  ok: 'w-1/2',
  good: 'w-3/4',
  rich: 'w-full',
}

// ─── Quick starters ────────────────────────────────────────────────────────

const QUICK_STARTER_ICONS: Record<string, React.ReactNode> = {
  '要不要做': (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <line x1="9" y1="3" x2="9" y2="5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      <line x1="9" y1="5" x2="4" y2="8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      <line x1="9" y1="5" x2="14" y2="8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      <rect x="2" y="8" width="4" height="3" rx="1" stroke="currentColor" strokeWidth="1.2"/>
      <rect x="12" y="8" width="4" height="3" rx="1" stroke="currentColor" strokeWidth="1.2"/>
      <line x1="4" y1="14" x2="14" y2="14" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      <line x1="9" y1="13" x2="9" y2="14" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  ),
  '两条路选一': (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <line x1="9" y1="14" x2="9" y2="9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      <line x1="9" y1="9" x2="4" y2="5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      <line x1="9" y1="9" x2="14" y2="5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      <circle cx="4" cy="4" r="1.5" stroke="currentColor" strokeWidth="1.2"/>
      <circle cx="14" cy="4" r="1.5" stroke="currentColor" strokeWidth="1.2"/>
    </svg>
  ),
  '怎么推进': (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <line x1="3" y1="9" x2="13" y2="9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      <polyline points="10,6 13,9 10,12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
      <line x1="3" y1="5" x2="7" y2="5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      <line x1="3" y1="13" x2="7" y2="13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  ),
  '为什么卡住了': (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="10" width="12" height="3" rx="0.8" stroke="currentColor" strokeWidth="1.2"/>
      <rect x="6" y="7" width="6" height="3" rx="0.8" stroke="currentColor" strokeWidth="1.2"/>
      <line x1="9" y1="4" x2="9" y2="6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeDasharray="1.5 1.5"/>
      <line x1="9" y1="13" x2="9" y2="15" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeDasharray="1.5 1.5"/>
    </svg>
  ),
  '要不要开口': (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 4.5C3 3.67 3.67 3 4.5 3H13.5C14.33 3 15 3.67 15 4.5V10.5C15 11.33 14.33 12 13.5 12H7L4 15V12H4.5C3.67 12 3 11.33 3 10.5V4.5Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
      <line x1="6" y1="7" x2="12" y2="7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      <line x1="6" y1="9.5" x2="10" y2="9.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  ),
  '这样做对吗': (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.2"/>
      <line x1="9" y1="3" x2="9" y2="5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      <line x1="9" y1="13" x2="9" y2="15" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      <line x1="3" y1="9" x2="5" y2="9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      <line x1="13" y1="9" x2="15" y2="9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      <circle cx="9" cy="9" r="1.5" fill="currentColor"/>
      <line x1="9" y1="7.5" x2="11" y2="6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  ),
}

const QUICK_STARTERS = [
  { label: '要不要做',    starter: '我在考虑是否要——',                              color: '#b45309', bg: '#fef3c7', border: '#fcd34d' },
  { label: '两条路选一',  starter: '摆在我面前有两个选择，我需要在它们之间做判断：',  color: '#1d4ed8', bg: '#dbeafe', border: '#93c5fd' },
  { label: '怎么推进',    starter: '我已经决定要做这件事，但不确定怎么走下一步：',    color: '#15803d', bg: '#dcfce7', border: '#86efac' },
  { label: '为什么卡住了', starter: '有一件事我知道应该做，但已经拖了很久：',          color: '#b91c1c', bg: '#fee2e2', border: '#fca5a5' },
  { label: '要不要开口',  starter: '有一件事我想说，但不确定说不说——',               color: '#7c3aed', bg: '#ede9fe', border: '#c4b5fd' },
  { label: '这样做对吗',  starter: '我最近做了一个决定，但现在有点后悔，想重新想想：', color: '#0e7490', bg: '#cffafe', border: '#67e8f9' },
]

// ─── Context field config ──────────────────────────────────────────────────

const CONTEXT_FIELDS = [
  {
    key: 'background',
    label: '我的基本情况',
    placeholder: '行业、公司阶段、你的角色……',
    hint: '让顾问理解你在什么处境下做这个决定',
  },
  {
    key: 'constraints',
    label: '主要约束条件',
    placeholder: '时间、资金、团队规模、已有资源……',
    hint: '什么是这次不可逾越的边界',
  },
  {
    key: 'tried',
    label: '我已经想过 / 试过',
    placeholder: '之前的分析、尝试、或已排除的选项……',
    hint: '避免顾问重复你已经想清楚的部分',
  },
  {
    key: 'lean',
    label: '我目前的倾向',
    placeholder: '倾向A还是B，或者还完全没方向……',
    hint: '让顾问聚焦在你的直觉需要被检验的地方',
  },
]

// ─── Main page (inner — uses useSearchParams) ──────────────────────────────

function HomeContent() {
  const searchParams = useSearchParams()
  const newTopic = searchParams.get('newTopic') || ''
  const fromQuestion = searchParams.get('fromQuestion') || ''

  const [input, setInput] = useState(newTopic)
  const [context, setContext] = useState<Record<string, string>>({})
  const [contextOpen, setContextOpen] = useState(false)
  const [attachedFile, setAttachedFile] = useState<{ name: string; content: string } | null>(null)
  const [attachedImage, setAttachedImage] = useState<{ name: string; base64: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [isListening, setIsListening] = useState(false)
  const [speechSupported, setSpeechSupported] = useState(false)
  const [userName, setUserName] = useState('')
  const [showNamePrompt, setShowNamePrompt] = useState(false)
  const [nameInput, setNameInput] = useState('')

  // ── Load user name from settings ──────────────────────────────────────────
  useEffect(() => {
    try {
      const settings = JSON.parse(localStorage.getItem('user-settings') || '{}')
      const name = settings.name || localStorage.getItem('user-name') || ''
      if (name) {
        setUserName(name)
      } else {
        const timer = setTimeout(() => setShowNamePrompt(true), 800)
        return () => clearTimeout(timer)
      }
    } catch {
      const timer = setTimeout(() => setShowNamePrompt(true), 800)
      return () => clearTimeout(timer)
    }
  }, [])
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null)
  const router = useRouter()

  const quality = getInputQuality(input, context)
  const canSubmit = input.trim().length >= 10 && !loading

  // ── Speech recognition setup ───────────────────────────────────────────────
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any
    const SpeechRecognitionAPI = w.SpeechRecognition || w.webkitSpeechRecognition
    if (SpeechRecognitionAPI) {
      setSpeechSupported(true)
      const recognition = new SpeechRecognitionAPI()
      recognition.lang = 'zh-CN'
      recognition.continuous = true
      recognition.interimResults = true

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onresult = (event: any) => {
        let transcript = ''
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            transcript += event.results[i][0].transcript
          }
        }
        if (transcript) {
          setInput(prev => prev + transcript)
        }
      }

      recognition.onend = () => {
        setIsListening(false)
      }

      recognition.onerror = () => {
        setIsListening(false)
      }

      recognitionRef.current = recognition
    }
  }, [])

  const toggleListening = () => {
    if (!recognitionRef.current) return
    if (isListening) {
      recognitionRef.current.stop()
      setIsListening(false)
    } else {
      recognitionRef.current.start()
      setIsListening(true)
    }
  }

  // ── File attachment ────────────────────────────────────────────────────────

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Image files → base64, let server handle via vision API
    if (file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = () => {
        const dataUrl = reader.result as string
        setAttachedImage({ name: file.name, base64: dataUrl })
        setAttachedFile(null) // clear any text file
      }
      reader.readAsDataURL(file)
      return
    }

    // Text files
    if (file.type === 'text/plain' || file.name.endsWith('.md') || file.name.endsWith('.txt')) {
      const text = await file.text()
      setAttachedFile({ name: file.name, content: text.slice(0, 8000) })
      setAttachedImage(null)
      return
    }

    // CSV
    if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
      const text = await file.text()
      setAttachedFile({ name: file.name, content: `[CSV数据]\n${text.slice(0, 4000)}` })
      setAttachedImage(null)
      return
    }

    // PDF: placeholder
    if (file.type === 'application/pdf') {
      setAttachedFile({ name: file.name, content: '[PDF附件——请在背景信息中描述其核心内容]' })
      setAttachedImage(null)
      return
    }

    setError(`暂不支持 ${file.name.split('.').pop()} 格式，请上传图片、TXT 或 CSV 文件`)
  }

  // ── Submit ─────────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!canSubmit) return
    setLoading(true)
    setError('')

    // Build enriched text input
    const contextLines = CONTEXT_FIELDS
      .filter(f => context[f.key]?.trim())
      .map(f => `【${f.label}】${context[f.key].trim()}`)

    const enrichedInput = [
      input.trim(),
      contextLines.length > 0 ? '\n\n补充信息：\n' + contextLines.join('\n') : '',
      attachedFile ? `\n\n附件内容（${attachedFile.name}）：\n${attachedFile.content}` : '',
    ].join('').trim()

    try {
      const res = await fetch('/api/decisions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: enrichedInput,
          tier: 'free',
          // Pass image separately so API can call vision
          imageBase64: attachedImage?.base64 ?? null,
          imageName: attachedImage?.name ?? null,
        }),
      })
      if (!res.ok) throw new Error('请求失败')
      const data = await res.json()
      if (data.decisionId) {
        const decisionPayload = JSON.stringify({
          id: data.decisionId,
          input: data.enrichedInput ?? enrichedInput,
          diagnosis: data.diagnosis,
          engineTier: data.engineTier,
          engineLabel: data.engineLabel,
        })
        sessionStorage.setItem(`decision-${data.decisionId}`, decisionPayload)
        localStorage.setItem(`decision-${data.decisionId}`, decisionPayload)
        router.push(`/decision/${data.decisionId}`)
      } else {
        setError('响应格式错误，请重试')
        setLoading(false)
      }
    } catch {
      setError('网络出了点问题，请再试一次。')
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 sm:px-5 py-10 sm:py-12">
      <div className="w-full max-w-[680px] space-y-6 sm:space-y-8">

        {/* Top bar: history + settings */}
        <div className="flex justify-end items-center gap-1 -mb-2">
          <button
            onClick={() => window.open('/history', '_blank')}
            className="text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-[var(--muted)] border border-transparent hover:border-[var(--border)]"
          >
            <svg width="13" height="13" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.2"/><path d="M6 3.5v2.8l1.5 1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
            历史记录
          </button>
          <button
            onClick={() => router.push('/settings')}
            className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors p-1.5 rounded-lg hover:bg-[var(--muted)] border border-transparent hover:border-[var(--border)]"
            title="设置"
          >
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
              <path d="M8 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" stroke="currentColor" strokeWidth="1.3"/>
              <path d="M13.3 9.7a1 1 0 0 0 .2 1.1l.04.04a1.2 1.2 0 0 1-1.7 1.7l-.04-.04a1 1 0 0 0-1.1-.2 1 1 0 0 0-.6.92V13a1.2 1.2 0 0 1-2.4 0v-.07a1 1 0 0 0-.65-.92 1 1 0 0 0-1.1.2l-.04.04a1.2 1.2 0 0 1-1.7-1.7l.04-.04a1 1 0 0 0 .2-1.1 1 1 0 0 0-.92-.6H3a1.2 1.2 0 0 1 0-2.4h.07a1 1 0 0 0 .92-.65 1 1 0 0 0-.2-1.1l-.04-.04a1.2 1.2 0 0 1 1.7-1.7l.04.04a1 1 0 0 0 1.1.2h.05A1 1 0 0 0 7.2 3V2.92a1.2 1.2 0 0 1 2.4 0V3a1 1 0 0 0 .6.92 1 1 0 0 0 1.1-.2l.04-.04a1.2 1.2 0 0 1 1.7 1.7l-.04.04a1 1 0 0 0-.2 1.1v.05a1 1 0 0 0 .92.6H13a1.2 1.2 0 0 1 0 2.4h-.07a1 1 0 0 0-.92.6Z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            顾问决策系统
          </h1>
          <p className="text-[var(--muted-foreground)] text-sm sm:text-base">
            {userName ? `${userName}，说出此刻需要决策的事` : '说出此刻需要决策的事'}
          </p>
          <p className="text-xs text-[var(--muted-foreground)]" style={{ fontFamily: '"Microsoft YaHei", "微软雅黑", sans-serif', fontWeight: 700 }}>
            大到事业转折，小到今日琐事——都值得认真对待
          </p>
        </div>

        {/* Name prompt (first visit or edit) */}
        {showNamePrompt && (
          <div className="rounded-xl border border-[var(--border)] bg-white px-5 py-4 space-y-3">
            <p className="text-sm text-[var(--muted-foreground)]">
              顾问们想知道——该怎么称呼你？
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    if (nameInput.trim()) {
                      const n = nameInput.trim()
                      const settings = JSON.parse(localStorage.getItem('user-settings') || '{}')
                      localStorage.setItem('user-settings', JSON.stringify({ ...settings, name: n }))
                      localStorage.setItem('user-name', n)
                      setUserName(n)
                    }
                    setShowNamePrompt(false)
                  }
                  if (e.key === 'Escape') setShowNamePrompt(false)
                }}
                placeholder="你的名字或希望的称呼…"
                autoFocus
                className="flex-1 text-sm border border-[var(--border)] rounded-lg px-3 py-2 focus:outline-none focus:border-[var(--primary)] transition-colors"
              />
              <button
                onClick={() => {
                  if (nameInput.trim()) {
                    const n = nameInput.trim()
                    const settings = JSON.parse(localStorage.getItem('user-settings') || '{}')
                    localStorage.setItem('user-settings', JSON.stringify({ ...settings, name: n }))
                    localStorage.setItem('user-name', n)
                    setUserName(n)
                  }
                  setShowNamePrompt(false)
                }}
                className="text-sm px-4 py-2 bg-[var(--primary)] text-white rounded-lg hover:bg-[#1E3A5F] transition-colors"
              >
                {nameInput.trim() ? '好的' : '跳过'}
              </button>
            </div>
          </div>
        )}

        {/* "Branched from previous decision" banner */}
        {fromQuestion && (
          <div className="flex items-start gap-3 px-4 py-3 rounded-lg border border-[var(--primary)]/20 bg-[var(--primary)]/5">
            <span className="text-xs text-[var(--primary)] flex-shrink-0 mt-0.5">↗ 延续自</span>
            <p className="text-xs text-[var(--muted-foreground)] leading-relaxed line-clamp-2">{fromQuestion}</p>
          </div>
        )}

        {/* Quick starters */}
        <div className="space-y-1.5">
          <p className="text-xs text-[var(--muted-foreground)]">不知道怎么开口？选一个接着写：</p>
          <div className="grid grid-cols-3 gap-1.5">
            {QUICK_STARTERS.map((item) => (
              <button
                key={item.label}
                onClick={() => {
                  setInput(item.starter)
                  setTimeout(() => {
                    const ta = textareaRef.current
                    if (ta) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length) }
                  }, 0)
                }}
                style={{ backgroundColor: item.bg, borderColor: item.border, color: item.color }}
                className="flex items-center justify-center gap-1.5 px-2 py-2 rounded-xl border text-xs font-bold transition-all hover:brightness-95 hover:shadow-sm"
              >
                <span>{QUICK_STARTER_ICONS[item.label]}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ── Main input area ─────────────────────────────────────────────── */}
        <div className="space-y-0">
          {/* Textarea with toolbar */}
          <div className="relative">
            <Textarea
              ref={textareaRef}
              placeholder={`▪ 商业  ▪ 产品  ▪ 增长  ▪ 人才\n▪ 合作  ▪ 投资  ▪ 个人  ▪ 关系\n\n告诉我……`}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit()
              }}
              onPaste={(e) => {
                const items = e.clipboardData?.items
                if (!items) return
                for (const item of Array.from(items)) {
                  if (item.type.startsWith('image/')) {
                    e.preventDefault()
                    const file = item.getAsFile()
                    if (!file) return
                    const reader = new FileReader()
                    reader.onload = () => {
                      setAttachedImage({ name: '粘贴的截图', base64: reader.result as string })
                    }
                    reader.readAsDataURL(file)
                    return
                  }
                }
              }}
              className="min-h-[116px] sm:min-h-[136px] text-base bg-white border-[var(--border)] border-2 focus:border-[var(--primary)] resize-none rounded-t-lg rounded-b-none p-4 sm:p-5 pr-24 shadow-sm"
              autoFocus={!showNamePrompt}
            />
            {/* Toolbar: mic + attach */}
            <div className="absolute bottom-3 right-3 flex items-center gap-1">
              {/* Mic button — shows only if speech supported */}
              {speechSupported && (
                <button
                  onClick={toggleListening}
                  className={`w-8 h-8 flex items-center justify-center rounded-md transition-colors ${
                    isListening
                      ? 'text-red-500 bg-red-50 animate-pulse'
                      : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)]'
                  }`}
                  title={isListening ? '点击停止录音' : '语音输入'}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="5.5" y="1" width="5" height="8" rx="2.5" stroke="currentColor" strokeWidth="1.2"/>
                    <path d="M2.5 7.5C2.5 10.538 4.962 13 8 13C11.038 13 13.5 10.538 13.5 7.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                    <line x1="8" y1="13" x2="8" y2="15" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                  </svg>
                </button>
              )}
              {/* Attach button */}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-8 h-8 flex items-center justify-center rounded-md text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors"
                title="上传截图或文件"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M13.5 8.5V12C13.5 12.8284 12.8284 13.5 12 13.5H4C3.17157 13.5 2.5 12.8284 2.5 12V4C2.5 3.17157 3.17157 2.5 4 2.5H7.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                  <path d="M10 2.5H13.5V6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M13.5 2.5L7.5 8.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                </svg>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.md,.csv,image/*,.pdf"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>
          </div>

          {/* Quality bar + attached file + context toggle */}
          <div className="bg-white border-x border-b border-[var(--border)] rounded-b-lg px-4 sm:px-5 py-3 space-y-2">
            {/* Quality indicator */}
            {quality.level !== 'empty' && (
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <div className="h-1 flex-1 bg-[var(--border)] rounded-full overflow-hidden mr-3">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${QUALITY_COLORS[quality.level] ?? ''} ${QUALITY_WIDTH[quality.level]}`}
                    />
                  </div>
                  <span className={`text-xs flex-shrink-0 ${
                    quality.level === 'rich' || quality.level === 'good'
                      ? 'text-emerald-600'
                      : 'text-[var(--muted-foreground)]'
                  }`}>
                    {quality.label}
                  </span>
                </div>
                {(quality.level === 'thin' || quality.level === 'ok') && (
                  <p className="text-xs text-[var(--muted-foreground)]">{quality.hint}</p>
                )}
              </div>
            )}

            {/* Attached image chip */}
            {attachedImage && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-[var(--muted-foreground)] flex-1 truncate">
                  🖼️ {attachedImage.name}
                  <span className="ml-1 text-emerald-600">（顾问将分析图片内容）</span>
                </span>
                <button
                  onClick={() => setAttachedImage(null)}
                  className="text-xs text-[var(--muted-foreground)] hover:text-[var(--destructive)] flex-shrink-0"
                >
                  移除
                </button>
              </div>
            )}

            {/* Attached file chip */}
            {attachedFile && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-[var(--muted-foreground)] flex-1 truncate">
                  📎 {attachedFile.name}
                </span>
                <button
                  onClick={() => setAttachedFile(null)}
                  className="text-xs text-[var(--muted-foreground)] hover:text-[var(--destructive)] flex-shrink-0"
                >
                  移除
                </button>
              </div>
            )}

            {/* Expand context toggle */}
            <button
              onClick={() => setContextOpen(prev => !prev)}
              className="text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] flex items-center gap-1 transition-colors"
            >
              <span className={`inline-block transition-transform duration-200 ${contextOpen ? 'rotate-90' : ''}`}>▶</span>
              {contextOpen ? <span className="font-semibold">收起补充信息</span> : <><span className="font-semibold">补充背景信息</span><span className="font-normal">（可选，但越多越准）</span></>}
            </button>
          </div>

          {/* Expandable context fields */}
          {contextOpen && (
            <div className="border-x border-b border-[var(--border)] rounded-b-lg bg-[var(--muted)]/30 px-4 sm:px-5 py-4 space-y-4 -mt-[1px]">
              <p className="text-xs text-[var(--muted-foreground)]">
                以下信息是顾问最想知道的——填得越具体，判断越准。全部可选。
              </p>
              {CONTEXT_FIELDS.map((field) => (
                <div key={field.key}>
                  <div className="mb-1">
                    <label className="text-sm font-medium block">{field.label}</label>
                    <span className="text-xs text-[var(--muted-foreground)]">{field.hint}</span>
                  </div>
                  <Textarea
                    placeholder={field.placeholder}
                    value={context[field.key] || ''}
                    onChange={(e) => setContext(prev => ({ ...prev, [field.key]: e.target.value }))}
                    className="min-h-[48px] text-sm bg-white border-[var(--border)] resize-none rounded-lg"
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Error */}
        {error && <p className="text-sm text-[var(--destructive)]">{error}</p>}

        {/* Voice recording status */}
        {isListening && (
          <div className="flex items-center gap-2 text-sm text-red-500">
            <span className="animate-pulse">●</span>
            正在录音，说完后点麦克风停止…
          </div>
        )}

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          style={input.trim().length > 0 ? {
            background: '#1a56db',
            boxShadow: '0 4px 14px rgba(26,86,219,0.35)',
            color: '#fff',
          } : {
            background: 'var(--primary)',
            color: '#fff',
          }}
          className="w-full h-12 text-base font-bold tracking-wide rounded-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed hover:brightness-110"
        >
          {loading ? '顾问们正在聆听…' : '召集顾问'}
        </button>

        {/* System scope hint */}
        <p className="text-center text-xs text-[var(--muted-foreground)]">
          本系统只处理真实决策，不支持闲聊或一般性提问
        </p>

        {/* Footer */}
        <div className="text-center space-y-1">
          <p className="text-xs text-[var(--muted-foreground)]">
            体验版 · 每天可用 2 次
          </p>
          <p className="text-xs text-[var(--muted-foreground)]">
            专业版使用旗舰级模型，分析更深 · 决策更准
          </p>
        </div>

      </div>
    </main>
  )
}

// ─── Export with Suspense (required for useSearchParams) ───────────────────

export default function HomePage() {
  return (
    <Suspense>
      <HomeContent />
    </Suspense>
  )
}
