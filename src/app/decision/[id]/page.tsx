'use client'

import { useEffect, useState, useRef, use, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ADVISORS } from '@/types/decision'
import type { AdvisorName, Diagnosis } from '@/types/decision'
import AdvisorAvatar from '@/components/AdvisorAvatar'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/AuthContext'

// ─── Types ─────────────────────────────────────────────────────────────────

interface ActionPlan {
  summary: string
  keyInsights: { advisor: string; insight: string }[]
  actionSteps: string[]
  risks: string
  timeframe?: string
}

interface DecisionData {
  id: string
  input: string
  diagnosis: Diagnosis
  engineTier: string
  engineLabel: string
  historyContext?: string | null
}

interface AdvisorStatement {
  advisor: AdvisorName
  content: string
  veto: boolean
  done: boolean
}

type FollowUpMessage =
  | { id: string; type: 'user'; content: string }
  | { id: string; type: 'advisor'; advisor: AdvisorName; content: string; veto: boolean; done: boolean }
  | { id: string; type: 'collision'; content: string; done: boolean }
  | { id: string; type: 'verdict'; content: string }

// ─── Markdown renderer ─────────────────────────────────────────────────────

function renderInline(text: string): React.ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/).map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={i}>{part.slice(2, -2)}</strong>
    if (part.startsWith('*') && part.endsWith('*')) return <em key={i}>{part.slice(1, -1)}</em>
    return part
  })
}

function MarkdownContent({ text }: { text: string }) {
  const lines = text.split('\n')
  const elements: React.ReactNode[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (line.startsWith('### ')) { elements.push(<p key={i} className="font-bold text-sm mt-3 mb-1">{renderInline(line.slice(4))}</p>); i++; continue }
    if (line.startsWith('## ') || line.startsWith('# ')) { elements.push(<p key={i} className="font-semibold text-sm mt-3 mb-1">{renderInline(line.replace(/^#+\s/, ''))}</p>); i++; continue }
    const numMatch = line.match(/^(\d+)\.\s(.+)/)
    if (numMatch) { elements.push(<div key={i} className="flex gap-2 my-1 text-sm leading-[1.75]"><span className="flex-shrink-0 text-[var(--muted-foreground)] w-4 text-right">{numMatch[1]}.</span><span>{renderInline(numMatch[2])}</span></div>); i++; continue }
    if (line.match(/^[-•]\s/)) { elements.push(<div key={i} className="flex gap-2 my-1 text-sm leading-[1.75]"><span className="flex-shrink-0 text-[var(--muted-foreground)] mt-0.5">·</span><span>{renderInline(line.replace(/^[-•]\s/, ''))}</span></div>); i++; continue }
    if (line.trim() === '') { elements.push(<div key={i} className="h-3" />); i++; continue }
    elements.push(<p key={i} className="text-sm leading-[1.75]">{renderInline(line)}</p>)
    i++
  }
  return <div className="space-y-1">{elements}</div>
}

// ─── Initial Analysis: Advisor Section (document style) ────────────────────

function AdvisorSection({ stmt, isActive }: { stmt: AdvisorStatement; isActive: boolean }) {
  const advisor = ADVISORS[stmt.advisor]
  if (!advisor) return null
  return (
    <div className="rounded-lg border bg-white overflow-hidden mb-4" style={{ borderColor: `${advisor.color}40` }}>
      <div className="flex items-center justify-between px-5 py-3 border-b" style={{ borderColor: `${advisor.color}25`, backgroundColor: `${advisor.color}06` }}>
        <div className="flex items-center gap-2.5">
          <AdvisorAvatar advisor={advisor} size={28} ring active={isActive} />
          <span className="text-sm font-semibold" style={{ color: advisor.color }}>{advisor.displayName}</span>
          <span className="text-xs text-[var(--muted-foreground)]">· {advisor.role}</span>
        </div>
        <div className="flex items-center gap-2">
          {stmt.veto && <span className="text-[10px] px-1.5 py-0.5 bg-red-50 text-red-600 rounded border border-red-200">否决</span>}
          {isActive && <span className="text-xs text-[var(--muted-foreground)] animate-pulse">分析中…</span>}
          {stmt.done && !isActive && <span className="text-[10px] text-[var(--muted-foreground)]">✓</span>}
        </div>
      </div>
      <div className="px-5 py-4" style={{ borderLeft: `3px solid ${advisor.color}` }}>
        {stmt.content ? (
          <MarkdownContent text={stmt.content} />
        ) : (
          <div className="flex gap-1 items-center py-1">
            {[0, 1, 2].map(i => (
              <div key={i} className="w-1.5 h-1.5 rounded-full animate-bounce opacity-50" style={{ backgroundColor: advisor.color, animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Initial Analysis: Collision Section ───────────────────────────────────

function CollisionSection({ content, done }: { content: string; done: boolean }) {
  return (
    <div className="my-8">
      <div className="flex items-center gap-3 mb-4">
        <div className="h-px flex-1 bg-[var(--border)]" />
        <span className="text-xs text-[var(--muted-foreground)] tracking-widest px-1">观点碰撞 · 合议结论</span>
        <div className="h-px flex-1 bg-[var(--border)]" />
      </div>
      <div className="rounded-lg border border-[var(--border)] bg-white px-5 py-4">
        {content ? (
          <MarkdownContent text={content} />
        ) : (
          <div className="flex gap-1 items-center py-1">
            {[0, 1, 2].map(i => (
              <div key={i} className="w-1.5 h-1.5 rounded-full bg-[var(--muted-foreground)] animate-bounce opacity-70" style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
        )}
        {!done && content && (
          <div className="flex gap-1 mt-2">
            {[0, 1, 2].map(i => (
              <div key={i} className="w-1.5 h-1.5 rounded-full bg-[var(--muted-foreground)] animate-bounce opacity-60" style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Follow-up: Chat Bubbles ────────────────────────────────────────────────

function UserBubble({ content }: { content: string }) {
  return (
    <div className="flex justify-end mb-3">
      <div className="max-w-[72%] sm:max-w-[65%] bg-white border border-[var(--border)] rounded-2xl rounded-tr-sm px-4 py-3 shadow-sm">
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{content}</p>
      </div>
    </div>
  )
}

function AdvisorBubble({ msg, isActive }: {
  msg: Extract<FollowUpMessage, { type: 'advisor' }>
  isActive: boolean
}) {
  const advisor = ADVISORS[msg.advisor]
  if (!advisor) return null
  return (
    <div className="flex flex-col mb-4 w-[95%]">
      <div className="flex items-center gap-2 mb-1.5 pl-1">
        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: advisor.color }} />
        <span className="text-xs font-semibold" style={{ color: advisor.color }}>{advisor.displayName}</span>
        {msg.veto && <span className="text-[10px] px-1.5 py-0.5 bg-red-50 text-red-600 rounded border border-red-200 ml-1">否决</span>}
        {isActive && <span className="text-xs text-[var(--muted-foreground)] animate-pulse ml-1">思考中…</span>}
      </div>
      <div
        className="rounded-2xl rounded-tl-sm px-4 py-3"
        style={{
          backgroundColor: `${advisor.color}08`,
          border: `1px solid ${advisor.color}25`,
          borderLeftWidth: '3px',
          borderLeftColor: advisor.color,
        }}
      >
        {msg.content ? (
          <MarkdownContent text={msg.content} />
        ) : (
          <div className="flex gap-1 items-center py-1">
            {[0, 1, 2].map(i => (
              <div key={i} className="w-1.5 h-1.5 rounded-full animate-bounce opacity-50" style={{ backgroundColor: advisor.color, animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function FollowUpCollisionBubble({ msg }: { msg: Extract<FollowUpMessage, { type: 'collision' }> }) {
  return (
    <div className="mb-4 w-full">
      <div className="rounded-xl bg-[var(--muted)]/40 border border-[var(--border)] px-4 py-3">
        {msg.content ? <MarkdownContent text={msg.content} /> : (
          <div className="flex gap-1 py-1">
            {[0, 1, 2].map(i => (
              <div key={i} className="w-1.5 h-1.5 rounded-full bg-[var(--muted-foreground)] animate-bounce opacity-70" style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function VerdictBubble({ content }: { content: string }) {
  return (
    <div className="flex justify-end mb-3">
      <div className="max-w-[72%] sm:max-w-[65%] bg-emerald-50 border border-emerald-200 rounded-2xl rounded-tr-sm px-4 py-3">
        <p className="text-[10px] text-emerald-600 mb-1 font-medium">我的决定</p>
        <p className="text-sm leading-relaxed">「{content}」</p>
      </div>
    </div>
  )
}

// ─── @ Advisor Picker ──────────────────────────────────────────────────────

function AdvisorPicker({ query, onSelect }: {
  query: string
  onSelect: (key: AdvisorName | 'all') => void
}) {
  const all = Object.entries(ADVISORS) as [AdvisorName, typeof ADVISORS[AdvisorName]][]
  const filtered = query
    ? all.filter(([, a]) => a.displayName.includes(query) || a.name.includes(query.toLowerCase()))
    : all

  return (
    <div className="absolute bottom-full left-0 mb-2 w-64 bg-white border border-[var(--border)] rounded-xl shadow-lg overflow-hidden z-50">
      <button
        onMouseDown={(e) => { e.preventDefault(); onSelect('all') }}
        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[var(--muted)]/50 transition-colors"
      >
        <div className="w-2.5 h-2.5 rounded-full bg-gradient-to-br from-[var(--primary)] to-purple-400 flex-shrink-0" />
        <span className="text-sm font-medium">@ 所有顾问</span>
        <span className="text-xs text-[var(--muted-foreground)] ml-auto">智能路由</span>
      </button>
      <div className="border-t border-[var(--border)]" />
      {filtered.map(([key, advisor]) => (
        <button
          key={key}
          onMouseDown={(e) => { e.preventDefault(); onSelect(key) }}
          className="w-full flex items-center gap-3 px-4 py-2 hover:bg-[var(--muted)]/50 transition-colors"
        >
          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: advisor.color }} />
          <div className="text-left">
            <span className="text-sm">{advisor.displayName}</span>
            <span className="text-[10px] text-[var(--muted-foreground)] ml-2">{advisor.role.split(' / ')[0]}</span>
          </div>
        </button>
      ))}
    </div>
  )
}

// ─── Chat Input (follow-up only) ────────────────────────────────────────────

function ChatInput({ onSend, disabled, activatedAdvisors, decisionId, coreQuestion, onExport, isExporting, hasPlan }: {
  onSend: (text: string, targetAdvisors: AdvisorName[] | null) => void
  disabled: boolean
  activatedAdvisors: AdvisorName[]
  decisionId: string
  coreQuestion: string
  onExport: () => void
  isExporting: boolean
  hasPlan: boolean
}) {
  const [value, setValue] = useState('')
  const [showPicker, setShowPicker] = useState(false)
  const [pickerQuery, setPickerQuery] = useState('')
  const [pickerPos, setPickerPos] = useState<{ top: number; left: number } | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const atButtonRef = useRef<HTMLButtonElement>(null)

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value
    setValue(val)
    const lastWord = val.slice(0, e.target.selectionStart || val.length).split(/\s/).pop() || ''
    if (lastWord.startsWith('@') && !lastWord.includes(' ')) {
      setShowPicker(true)
      setPickerQuery(lastWord.slice(1))
    } else {
      setShowPicker(false)
      setPickerQuery('')
    }
  }

  const selectAdvisor = (key: AdvisorName | 'all') => {
    const label = key === 'all' ? '所有顾问' : ADVISORS[key].displayName
    // Remove any trailing partial @... then append @name
    const trimmed = value.replace(/@\S*$/, '').trimEnd()
    setValue(trimmed ? `${trimmed} @${label} ` : `@${label} `)
    closePicker()
    textareaRef.current?.focus()
  }

  const parseTargets = (text: string): AdvisorName[] | null => {
    if (text.includes('@所有顾问') || text.includes('@所有人')) return null
    const mentioned: AdvisorName[] = []
    for (const [key, a] of Object.entries(ADVISORS) as [AdvisorName, typeof ADVISORS[AdvisorName]][]) {
      if (text.includes(`@${a.displayName}`)) mentioned.push(key)
    }
    return mentioned.length > 0 ? mentioned : null
  }

  const handleSend = () => {
    if (!value.trim() || disabled) return
    const targets = parseTargets(value)
    onSend(value.trim(), targets)
    setValue('')
    setShowPicker(false)
  }

  // Open a new tab pre-filled with the current text as a new decision topic
  const handleBranchOff = () => {
    if (!value.trim()) return
    const params = new URLSearchParams({
      newTopic: value.trim(),
      fromDecision: decisionId,
      fromQuestion: coreQuestion,
    })
    window.open(`/?${params.toString()}`, '_blank')
    setValue('')
    setShowPicker(false)
  }

  // Trigger @ picker via button click — use fixed positioning to escape sticky container
  const handleAtButton = () => {
    const btn = atButtonRef.current
    if (!btn) return
    const rect = btn.getBoundingClientRect()
    setPickerPos({ top: rect.top, left: rect.left })
    setPickerQuery('')
    setShowPicker(true)
    textareaRef.current?.focus()
  }

  const closePicker = () => {
    setShowPicker(false)
    setPickerPos(null)
  }

  return (
    <div className="space-y-1.5">
      {/* Picker — fixed position so it escapes the sticky container */}
      {showPicker && pickerPos && (
        <>
          <div className="fixed inset-0 z-[9998]" onMouseDown={closePicker} />
          <div
            className="fixed z-[9999]"
            style={{ bottom: window.innerHeight - pickerPos.top + 8, left: pickerPos.left }}
          >
            <AdvisorPicker query={pickerQuery} onSelect={selectAdvisor} />
          </div>
        </>
      )}

      {/* Row 1: Textarea */}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onInput={(e) => {
          const el = e.currentTarget
          el.style.height = 'auto'
          el.style.height = Math.min(el.scrollHeight, 220) + 'px'
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); handleSend() }
          if (e.key === 'Escape') setShowPicker(false)
        }}
        placeholder="补充信息、追问，或指定某位顾问深聊…"
        disabled={disabled}
        rows={1}
        className="w-full text-sm bg-white border border-[var(--border)] rounded-xl px-4 py-2.5 resize-none focus:outline-none focus:border-[var(--primary)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        style={{ minHeight: '40px', maxHeight: '220px' }}
      />

      {/* Row 2: 所有操作合并一行 */}
      <div className="flex items-center gap-1.5">
        {/* @ 指定顾问 */}
        <button
          ref={atButtonRef}
          onMouseDown={(e) => { e.preventDefault(); showPicker ? closePicker() : handleAtButton() }}
          disabled={disabled}
          className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg border border-[var(--border)] text-[var(--muted-foreground)] hover:border-[var(--primary)] hover:text-[var(--primary)] transition-colors disabled:opacity-30 flex-shrink-0"
          title="指定某位顾问回应"
        >
          <span className="font-semibold">@</span>
          <span>指定顾问</span>
        </button>

        {/* 顾问快捷 chips */}
        <div className="flex gap-1 flex-1 overflow-hidden">
          {activatedAdvisors.slice(0, 4).map((name) => {
            const a = ADVISORS[name]
            return (
              <button
                key={name}
                onMouseDown={(e) => { e.preventDefault(); setValue(prev => prev.trimEnd() + ` @${a.displayName} `); textareaRef.current?.focus() }}
                disabled={disabled}
                className="flex items-center gap-1 text-[10px] pl-0.5 pr-2 py-0.5 rounded-full border transition-colors hover:opacity-80 disabled:opacity-20 flex-shrink-0"
                style={{ borderColor: a.color, color: a.color }}
              >
                <AdvisorAvatar advisor={a} size={16} />
                {a.displayName}
              </button>
            )
          })}
        </div>

        {/* 另开对话（仅输入内容后显示） */}
        {value.trim() && (
          <button
            onMouseDown={(e) => { e.preventDefault(); handleBranchOff() }}
            className="text-[10px] text-[var(--muted-foreground)] hover:text-[var(--primary)] transition-colors flex-shrink-0 whitespace-nowrap"
            title="把这个问题另开一个新决策对话"
          >
            新议题↗
          </button>
        )}

        {/* 查看方案（仅 hasPlan 时显示） */}
        {hasPlan && (
          <button
            onMouseDown={(e) => { e.preventDefault(); onExport() }}
            className="flex items-center gap-1 text-[10px] text-[var(--primary)] hover:opacity-80 transition-opacity flex-shrink-0 whitespace-nowrap"
            title="查看完整行动方案"
          >
            <svg width="11" height="11" viewBox="0 0 14 14" fill="none"><path d="M2 7h10M7 2l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            <span>查看方案</span>
          </button>
        )}

        {/* 发送 */}
        <button
          onClick={handleSend}
          disabled={!value.trim() || disabled}
          className="flex-shrink-0 w-8 h-8 rounded-xl bg-[var(--primary)] text-white flex items-center justify-center hover:bg-[#1E3A5F] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M14 8L2 2L5 8L2 14L14 8Z" fill="currentColor" />
          </svg>
        </button>
      </div>
    </div>
  )
}

// ─── Print Modal ───────────────────────────────────────────────────────────

// ─── Inline Action Plan Card ────────────────────────────────────────────────

function ActionPlanCard({
  plan, onView, onUpdate, hasFollowUp, isUpdating,
}: {
  plan: ActionPlan
  onView: () => void
  onUpdate: () => void
  hasFollowUp: boolean
  isUpdating: boolean
}) {
  return (
    <div className="rounded-xl border border-[#9A7B4F]/30 bg-[#9A7B4F]/5 overflow-hidden mb-6">
      {/* 仪式感 header */}
      <div className="px-5 pt-7 pb-5 border-b border-[#9A7B4F]/20">
        <div className="flex items-center gap-4">
          <div className="h-px flex-1" style={{ background: 'linear-gradient(to right, transparent, #9A7B4F)', opacity: 0.5 }} />
          <span className="text-[15px] font-semibold tracking-[0.3em] select-none" style={{ color: '#7A5C2E' }}>
            决 策 行 动 方 案
          </span>
          <div className="h-px flex-1" style={{ background: 'linear-gradient(to left, transparent, #9A7B4F)', opacity: 0.5 }} />
        </div>
        <div className="flex justify-center mt-3">
          <button onClick={onView} className="text-[11px] tracking-wider hover:opacity-70 transition-opacity" style={{ color: '#9A7B4F' }}>
            下载 PDF
          </button>
        </div>
      </div>

      {/* 报告内容区 */}
      <div className="px-6 py-5 space-y-5">

        {/* 综合研判 */}
        {plan.summary && (
          <div>
            <p className="text-[10px] font-semibold tracking-[0.18em] mb-2" style={{ color: '#9A7B4F' }}>综合研判</p>
            <p className="text-sm leading-[1.85] text-[var(--foreground)]">{plan.summary}</p>
          </div>
        )}

        {/* 行动步骤 */}
        {plan.actionSteps?.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold tracking-[0.18em] mb-3" style={{ color: '#9A7B4F' }}>行动步骤</p>
            <div className="space-y-3">
              {plan.actionSteps.map((step, i) => (
                <div key={i} className="flex gap-3 text-sm">
                  <span className="flex-shrink-0 text-[11px] font-semibold w-5 pt-0.5 text-right" style={{ color: '#9A7B4F' }}>{i + 1}.</span>
                  <span className="text-[var(--foreground)] leading-[1.8]">{step}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 顾问洞察 */}
        {plan.keyInsights?.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold tracking-[0.18em] mb-3" style={{ color: '#9A7B4F' }}>顾问洞察</p>
            <div className="space-y-2.5">
              {plan.keyInsights.map((ins, i) => (
                <div key={i} className="flex gap-2.5 text-sm">
                  <span className="flex-shrink-0 font-medium text-[var(--foreground)] min-w-[3em]">{ins.advisor}</span>
                  <span className="text-[var(--muted-foreground)] leading-[1.75] border-l border-[#9A7B4F]/25 pl-2.5">{ins.insight}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 注意事项 */}
        {plan.risks && (
          <div>
            <p className="text-[10px] font-semibold tracking-[0.18em] mb-2" style={{ color: '#9A7B4F' }}>注意事项</p>
            <p className="text-sm text-[var(--foreground)] leading-[1.8] pl-3 border-l-2" style={{ borderColor: '#9A7B4F' }}>{plan.risks}</p>
          </div>
        )}

      </div>

      {/* Update button — 追问后才出现 */}
      {hasFollowUp && (
        <div className="px-5 py-3 border-t border-[#9A7B4F]/20 flex justify-end">
          <button
            onClick={onUpdate}
            disabled={isUpdating}
            className="flex items-center gap-1.5 text-xs hover:opacity-70 transition-opacity disabled:opacity-40"
            style={{ color: '#9A7B4F' }}
          >
            {isUpdating ? (
              <><span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />更新中…</>
            ) : (
              <>↻ 根据追问更新方案</>
            )}
          </button>
        </div>
      )}
    </div>
  )
}

function PrintModal({
  plan,
  coreQuestion,
  verdict,
  advisorStatements,
  userName,
  onClose,
  onDelete,
}: {
  plan: ActionPlan
  coreQuestion: string
  verdict?: string
  advisorStatements: AdvisorStatement[]
  userName?: string
  onClose: () => void
  onDelete: () => void
}) {
  const today = new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })
  const [isDownloading, setIsDownloading] = useState(false)

  const handleDownloadPDF = () => {
    setIsDownloading(true)
    try {
      const insightsHTML = (plan.keyInsights ?? []).map(ins => {
        const matchedEntry = Object.entries(ADVISORS).find(([, a]) => a.displayName === ins.advisor || a.name === ins.advisor.toLowerCase())
        const color = matchedEntry ? matchedEntry[1].color : '#94a3b8'
        return `
          <div style="display:flex;gap:12px;align-items:flex-start;margin-bottom:10px;">
            <div style="flex-shrink:0;width:6px;height:6px;border-radius:50%;background:${color};margin-top:7px;"></div>
            <div>
              <span style="font-size:11px;font-weight:600;color:${color};">${ins.advisor}</span>
              <p style="font-size:13px;color:#374151;line-height:1.6;margin:2px 0 0;">${ins.insight}</p>
            </div>
          </div>`
      }).join('')

      const stepsHTML = (plan.actionSteps ?? []).map((step, i) => `
        <li style="display:flex;gap:12px;align-items:flex-start;margin-bottom:10px;">
          <span style="flex-shrink:0;width:20px;height:20px;border-radius:50%;background:#1a3a5c;color:white;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;margin-top:2px;">${i + 1}</span>
          <span style="font-size:13px;color:#374151;line-height:1.6;">${step}</span>
        </li>`
      ).join('')

      const verdictHTML = verdict ? `
        <div style="border-radius:12px;border:1px solid #a7f3d0;background:#ecfdf5;padding:16px 20px;margin-bottom:24px;">
          <p style="font-size:10px;color:#059669;font-weight:600;margin:0 0 4px;letter-spacing:0.05em;">我的决定</p>
          <p style="font-size:13px;color:#064e3b;line-height:1.6;margin:0;">「${verdict}」</p>
        </div>` : ''

      const risksHTML = plan.risks ? `
        <div style="border-radius:8px;border:1px solid #fde68a;background:#fffbeb;padding:12px 16px;margin-bottom:24px;">
          <p style="font-size:10px;color:#d97706;font-weight:600;margin:0 0 4px;letter-spacing:0.05em;">注意事项</p>
          <p style="font-size:13px;color:#92400e;line-height:1.6;margin:0;">${plan.risks}</p>
        </div>` : ''

      const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>决策行动方案</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif; background: white; color: #111; }
    .page { max-width: 680px; margin: 0 auto; padding: 48px 40px; }
    h2 { font-size: 10px; font-weight: 600; letter-spacing: 0.15em; color: #9ca3af; text-transform: uppercase; margin-bottom: 10px; }
    ol { list-style: none; padding: 0; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      @page { margin: 16mm 14mm; }
    }
  </style>
</head>
<body>
<div class="page">
  <p style="font-size:10px;letter-spacing:0.2em;color:#9ca3af;text-transform:uppercase;margin-bottom:8px;">决策行动方案</p>
  <h1 style="font-size:20px;font-weight:700;color:#111;line-height:1.4;margin-bottom:6px;">${coreQuestion}</h1>
  <p style="font-size:11px;color:#9ca3af;margin-bottom:32px;">${today}${userName ? ' · ' + userName : ''}</p>

  <div style="margin-bottom:24px;">
    <h2>综合研判</h2>
    <p style="font-size:13px;color:#374151;line-height:1.7;">${plan.summary}</p>
  </div>

  ${verdictHTML}

  <div style="margin-bottom:24px;">
    <h2>行动步骤</h2>
    <ol>${stepsHTML}</ol>
  </div>

  ${insightsHTML ? `<div style="margin-bottom:24px;"><h2>顾问核心洞察</h2>${insightsHTML}</div>` : ''}

  ${risksHTML}

  ${plan.timeframe ? `<p style="font-size:11px;color:#9ca3af;margin-bottom:24px;">建议时间窗口：${plan.timeframe}</p>` : ''}

  <div style="border-top:1px solid #f3f4f6;padding-top:16px;margin-top:8px;">
    <p style="font-size:10px;color:#d1d5db;text-align:center;">由顾问决策系统生成 · 仅供参考</p>
  </div>
</div>
<script>window.onload = function(){ window.print(); window.onafterprint = function(){ window.close(); }; }</script>
</body>
</html>`

      const win = window.open('', '_blank', 'width=800,height=900')
      if (win) {
        win.document.write(html)
        win.document.close()
      }
    } catch (e) {
      console.error(e)
    } finally {
      setIsDownloading(false)
    }
  }

  return (
    <>
      {/* Print-only global styles */}
      <style>{`
        @media print {
          body > * { display: none !important; }
          #print-modal { display: block !important; position: static !important; inset: auto !important; background: white; z-index: 99999; box-shadow: none !important; }
          #print-modal .bg-black\\/50 { background: transparent !important; }
          #print-no { display: none !important; }
          #pdf-body { padding: 0 !important; }
        }
      `}</style>

      {/* Screen overlay */}
      <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center overflow-y-auto py-8 px-4" id="print-modal">
        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[640px] overflow-hidden">

          {/* Modal toolbar (hidden on print) */}
          <div id="print-no" className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50">
            <span className="text-sm font-medium text-gray-700">行动方案预览</span>
            <div className="flex gap-3">
              <button
                onClick={handleDownloadPDF}
                disabled={isDownloading}
                className="text-sm px-4 py-1.5 bg-[var(--primary)] text-white rounded-lg hover:bg-[#1E3A5F] transition-colors disabled:opacity-50 flex items-center gap-1.5"
              >
                {isDownloading ? (
                  <><span className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />生成中…</>
                ) : '下载 PDF'}
              </button>
              <button
                onClick={onClose}
                className="text-sm px-4 py-1.5 border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
              >
                返回
              </button>
            </div>
          </div>

          {/* Document body — captured for PDF */}
          <div id="pdf-body" className="px-8 py-8 space-y-7" style={{ backgroundColor: '#ffffff' }}>

            {/* Header */}
            <div>
              <p className="text-[10px] tracking-[0.2em] text-gray-500 uppercase mb-2">决策行动方案</p>
              <h1 className="text-xl font-bold text-gray-900 leading-snug">{coreQuestion}</h1>
              <p className="text-xs text-gray-500 mt-1.5">{today}</p>
            </div>

            {/* Summary */}
            <div>
              <h2 className="text-[11px] font-semibold tracking-widest text-gray-600 uppercase mb-2">综合研判</h2>
              <p className="text-sm leading-relaxed text-gray-700">{plan.summary}</p>
            </div>

            {/* Verdict if set */}
            {verdict && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4">
                <p className="text-[10px] text-emerald-600 font-semibold mb-1 tracking-wide">我的决定</p>
                <p className="text-sm text-emerald-900 leading-relaxed">「{verdict}」</p>
              </div>
            )}

            {/* Action steps */}
            <div>
              <h2 className="text-[11px] font-semibold tracking-widest text-gray-600 uppercase mb-3">行动步骤</h2>
              <ol className="space-y-2">
                {plan.actionSteps.map((step, i) => (
                  <li key={i} className="flex gap-3 items-start">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[var(--primary)] text-white text-[10px] font-bold flex items-center justify-center mt-0.5">{i + 1}</span>
                    <span className="text-sm text-gray-700 leading-relaxed">{step}</span>
                  </li>
                ))}
              </ol>
            </div>

            {/* Key insights */}
            {plan.keyInsights?.length > 0 && (
              <div>
                <h2 className="text-[11px] font-semibold tracking-widest text-gray-600 uppercase mb-3">顾问核心洞察</h2>
                <div className="space-y-3">
                  {plan.keyInsights.map((ins, i) => {
                    const matchedEntry = Object.entries(ADVISORS).find(([, a]) => a.displayName === ins.advisor || a.name === ins.advisor.toLowerCase())
                    const color = matchedEntry ? matchedEntry[1].color : '#94a3b8'
                    return (
                      <div key={i} className="flex gap-3 items-start">
                        <div className="flex-shrink-0 mt-1.5 w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
                        <div>
                          <span className="text-xs font-semibold" style={{ color }}>{ins.advisor}</span>
                          <p className="text-sm text-gray-600 leading-relaxed mt-0.5">{ins.insight}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Risks */}
            {plan.risks && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                <p className="text-[10px] text-amber-600 font-semibold mb-1 tracking-wide">注意事项</p>
                <p className="text-sm text-amber-800 leading-relaxed">{plan.risks}</p>
              </div>
            )}

            {/* Timeframe */}
            {plan.timeframe && (
              <p className="text-xs text-gray-500">建议时间窗口：{plan.timeframe}</p>
            )}

            {/* Footer */}
            <div className="border-t border-gray-100 pt-4">
              <p className="text-[10px] text-gray-500 text-center">由顾问决策系统生成 · 仅供参考</p>
            </div>
          </div>

          {/* Privacy choice section (hidden on print) */}
          <div id="print-no" className="px-8 pb-8 border-t border-gray-100">
            <p className="text-xs text-gray-600 leading-relaxed pt-5 mb-5">
              {userName ? `${userName}，这次的事` : '这次的事'}，只有你和顾问们知道。<br />
              <span className="text-gray-500">记录留着，下次遇到类似的事，他们会更懂你。</span><br />
              <span className="text-gray-500">如果太私密——看一眼就好，走的时候不留痕迹。</span>
            </p>
            <div className="flex flex-col gap-2.5">
              <button
                onClick={onClose}
                className="w-full text-left flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-200 hover:border-gray-300 transition-colors group"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                <div>
                  <p className="text-sm text-gray-700 font-medium">留存这次记录</p>
                  <p className="text-[11px] text-gray-500 mt-0.5">让系统记住你的思考方式，下次更准</p>
                </div>
              </button>
              <button
                onClick={handleDownloadPDF}
                disabled={isDownloading}
                className="w-full text-left flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-200 hover:border-gray-300 transition-colors group disabled:opacity-50"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                <div>
                  <p className="text-sm text-gray-700 font-medium">
                    {isDownloading ? '正在生成 PDF…' : '下载 PDF，然后带走'}
                  </p>
                  <p className="text-[11px] text-gray-500 mt-0.5">下载到本地文件夹，手机也支持</p>
                </div>
              </button>
              <button
                onClick={onDelete}
                className="w-full text-left flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-100 hover:border-red-100 hover:bg-red-50/40 transition-colors group"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-gray-300 group-hover:bg-red-300 flex-shrink-0 transition-colors" />
                <div>
                  <p className="text-sm text-gray-500 group-hover:text-red-500 transition-colors font-medium">阅后即焚，不留痕迹</p>
                  <p className="text-[11px] text-gray-500 mt-0.5">从本设备彻底删除，无法恢复</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────

export default function DecisionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { user } = useAuth()
  const [data, setData] = useState<DecisionData | null>(null)
  const [notFound, setNotFound] = useState(false)

  // ── Phase: probing → analyzing → done ─────────────────────────────────────
  const [phase, setPhase] = useState<'probing' | 'analyzing' | 'done'>('probing')
  const [probeAnswers, setProbeAnswers] = useState<Record<string, string>>({})
  const [outputMode, setOutputMode] = useState<'detailed' | 'concise'>('detailed')

  // ── Initial analysis state (document-style display) ────────────────────────
  const [advisorStatements, setAdvisorStatements] = useState<AdvisorStatement[]>([])
  const [currentAdvisor, setCurrentAdvisor] = useState<AdvisorName | null>(null)
  const [collisionContent, setCollisionContent] = useState('')
  const [collisionDone, setCollisionDone] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)

  // ── 决策模式（由服务端自动识别后通过 SSE meta 事件传回）─────────────────────
  const [decisionMode, setDecisionMode] = useState<{
    mode: string
    modeLabel: { label: string; desc: string; color: string }
  } | null>(null)

  // 从 collisionContent 中解析出【收尾】部分
  const closingText = collisionDone ? (() => {
    const match = collisionContent.match(/【收尾】\s*([\s\S]+?)$/)
    return match ? match[1].trim() : ''
  })() : ''
  const mainCollisionContent = collisionDone
    ? collisionContent.replace(/【收尾】[\s\S]*$/, '').trim()
    : collisionContent

  // ── Verdict ────────────────────────────────────────────────────────────────
  const [showVerdictInput, setShowVerdictInput] = useState(false)
  const [verdictText, setVerdictText] = useState('')
  const [verdictTag, setVerdictTag] = useState('')
  const [verdictSaved, setVerdictSaved] = useState(false)
  const [savedVerdictContent, setSavedVerdictContent] = useState('')

  // ── Export / Print state ──────────────────────────────────────────────────
  const [showPrintModal, setShowPrintModal] = useState(false)
  const [actionPlan, setActionPlan] = useState<ActionPlan | null>(null)
  const [isExporting, setIsExporting] = useState(false)

  // ── Follow-up chat state ───────────────────────────────────────────────────
  const [chatMessages, setChatMessages] = useState<FollowUpMessage[]>([])
  const [isChatGenerating, setIsChatGenerating] = useState(false)
  const [chatCurrentAdvisor, setChatCurrentAdvisor] = useState<AdvisorName | null>(null)

  const [userName, setUserName] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const planCardRef = useRef<HTMLDivElement>(null)
  const planLoadedFromCacheRef = useRef(false)
  const scrolledToPlanRef = useRef(false)
  const msgIdCounter = useRef(0)
  const newId = () => `msg-${++msgIdCounter.current}`
  const autoGeneratedRef = useRef(false)

  useEffect(() => {
    try {
      const settings = JSON.parse(localStorage.getItem('user-settings') || '{}')
      const name = settings.name || localStorage.getItem('user-name') || ''
      if (name) setUserName(name)
    } catch {
      const name = localStorage.getItem('user-name')
      if (name) setUserName(name)
    }
  }, [])

  useEffect(() => {
    async function loadDecision() {
      // 1. sessionStorage = same-tab fast access (new decision just submitted)
      const stored = sessionStorage.getItem(`decision-${id}`)
      if (stored) {
        try {
          const parsed = JSON.parse(stored)
          console.log('%c[seenMoment]', 'color:orange;font-weight:bold', parsed?.diagnosis?.seenMoment ?? '❌ 无')
          setData(parsed)
        } catch { setNotFound(true); return }
      } else {
        // 2. Supabase fallback for cross-device / direct URL access
        try {
          const supabase = createClient()
          const { data: rawRow } = await supabase
            .from('decisions')
            .select('*')
            .eq('id', id)
            .single()
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const row = rawRow as any
          if (row) {
            const diag = row.diagnosis as Record<string, unknown> | null
            setData({
              id: row.id,
              input: row.input,
              diagnosis: diag as unknown as Diagnosis,
              engineTier: (diag?.engineTier as string) ?? 'free',
              engineLabel: (diag?.engineLabel as string) ?? '',
            })
            // Restore analysis state from Supabase
            const a = row.analysis as Record<string, unknown> | null
            if (a) {
              if (Array.isArray(a.advisorStatements) && a.advisorStatements.length) setAdvisorStatements(a.advisorStatements)
              if (a.collisionContent) setCollisionContent(a.collisionContent as string)
              if (a.collisionDone) setCollisionDone(true)
              if (a.phase === 'done' || a.phase === 'analyzing') setPhase(a.phase as 'done' | 'analyzing')
              if (a.verdictSaved) { setVerdictSaved(true); setSavedVerdictContent((a.savedVerdictContent as string) || '') }
              if (a.actionPlan) { setActionPlan(a.actionPlan as ActionPlan); planLoadedFromCacheRef.current = true }
            }
            if (row.verdict) { setVerdictSaved(true); setSavedVerdictContent(row.verdict as string) }
          } else {
            setNotFound(true)
          }
        } catch { setNotFound(true) }
        return
      }

      // ── Restore analysis state from sessionStorage (same-tab) ───
      const savedAnalysis = sessionStorage.getItem(`analysis-${id}`)
      if (savedAnalysis) {
        try {
          const a = JSON.parse(savedAnalysis)
          if (a.advisorStatements?.length) setAdvisorStatements(a.advisorStatements)
          if (a.collisionContent) setCollisionContent(a.collisionContent)
          if (a.collisionDone) setCollisionDone(true)
          if (a.phase === 'done' || a.phase === 'analyzing') setPhase(a.phase)
          if (a.verdictSaved) { setVerdictSaved(true); setSavedVerdictContent(a.savedVerdictContent || '') }
        } catch { /* ignore */ }
      }
    }
    loadDecision()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  // ── Auto-skip probes if setting is off ─────────────────────────────────────
  const autoSkippedRef = useRef(false)
  useEffect(() => {
    if (!data || phase !== 'probing' || autoSkippedRef.current) return
    try {
      const settings = JSON.parse(localStorage.getItem('user-settings') || '{}')
      if (settings.showProbeQuestions === false) {
        autoSkippedRef.current = true
        startAnalysis(true)
      }
    } catch { /* ignore */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, phase])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [advisorStatements, collisionContent, chatMessages])

  // ── 分析完成后自动生成行动方案 ────────────────────────────────────────────
  useEffect(() => {
    const isDone = phase === 'done' && collisionDone
    if (!isDone) return
    if (actionPlan) return
    if (autoGeneratedRef.current) return
    autoGeneratedRef.current = true
    generateActionPlan(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, collisionDone])

  // ── 从历史打开时，自动滚动到行动方案 ────────────────────────────────────
  useEffect(() => {
    if (!actionPlan) return
    if (!planLoadedFromCacheRef.current) return   // 只对"从历史载入"生效，首次生成不滚
    if (scrolledToPlanRef.current) return
    if (phase !== 'done' || !collisionDone) return
    scrolledToPlanRef.current = true
    setTimeout(() => {
      const el = planCardRef.current
      if (!el) return
      // 计算滚动位置，减去顶部固定导航栏高度（约56px）+ 额外留白20px
      const top = el.getBoundingClientRect().top + window.scrollY - 76
      window.scrollTo({ top, behavior: 'smooth' })
    }, 350)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actionPlan, phase, collisionDone])

  // ── Auto-save analysis state (sessionStorage for same-tab) ──
  useEffect(() => {
    if (advisorStatements.length === 0 && phase === 'probing') return
    const payload = JSON.stringify({
      advisorStatements,
      collisionContent,
      collisionDone,
      phase,
      verdictSaved,
      savedVerdictContent,
    })
    sessionStorage.setItem(`analysis-${id}`, payload)
  }, [id, advisorStatements, collisionContent, collisionDone, phase, verdictSaved, savedVerdictContent])

  // ── Save to Supabase (upsert) ─────────────────────────────────────────────
  const saveToHistory = useCallback((verdictContent?: string) => {
    if (!data || !user) return
    const analysisPayload = {
      advisorStatements,
      collisionContent,
      collisionDone,
      phase,
      verdictSaved: verdictContent !== undefined ? true : verdictSaved,
      savedVerdictContent: verdictContent ?? savedVerdictContent,
      actionPlan,
    }
    const supabase = createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    supabase.from('decisions').upsert({
      id,
      user_id: user.id,
      input: data.input,
      diagnosis: { ...data.diagnosis, engineTier: data.engineTier, engineLabel: data.engineLabel } as unknown as import('@/lib/supabase/types').Json,
      analysis: analysisPayload as unknown as import('@/lib/supabase/types').Json,
      verdict: verdictContent ?? (verdictSaved ? savedVerdictContent : null) ?? null,
      updated_at: new Date().toISOString(),
    } as any, { onConflict: 'id' }).then(() => { /* fire and forget */ })
  }, [data, id, user, advisorStatements, collisionContent, collisionDone, phase, verdictSaved, savedVerdictContent, actionPlan])

  // ── Initial analysis streaming ─────────────────────────────────────────────
  const runInitialAnalysis = useCallback(async (
    contextInput: string,
    diagnosis: Diagnosis,
    answers: Record<string, string>,
    tier: string,
    mode: string,
    historyCtx?: string | null,
  ) => {
    setIsAnalyzing(true)
    try {
      const response = await fetch('/api/decisions/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: contextInput, diagnosis, probeAnswers: answers, tier, outputMode: mode, historyContext: historyCtx ?? null }),
      })

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      if (!reader) return

      let buffer = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (let li = 0; li < lines.length; li++) {
          const line = lines[li]
          if (!line.startsWith('event: ')) continue
          const event = line.slice(7).trim()
          const dataLine = lines[li + 1]
          if (!dataLine?.startsWith('data: ')) continue
          try {
            const payload = JSON.parse(dataLine.slice(6))
            switch (event) {
              case 'meta':
                // 服务端发回的决策模式元数据（温柔/理性/严厉）
                if (payload.mode && payload.modeLabel) {
                  setDecisionMode({ mode: payload.mode, modeLabel: payload.modeLabel })
                }
                break
              case 'advisor_start':
                setCurrentAdvisor(payload.advisor)
                setAdvisorStatements(prev => [...prev, { advisor: payload.advisor, content: '', veto: false, done: false }])
                break
              case 'advisor_chunk':
                setAdvisorStatements(prev => prev.map(s =>
                  s.advisor === payload.advisor && !s.done
                    ? { ...s, content: s.content + payload.chunk } : s
                ))
                break
              case 'advisor_done':
                setAdvisorStatements(prev => prev.map(s =>
                  s.advisor === payload.advisor && !s.done
                    ? { ...s, done: true, veto: payload.veto } : s
                ))
                setCurrentAdvisor(null)
                break
              case 'collision_chunk':
                setCollisionContent(prev => prev + payload.chunk)
                break
              case 'phase':
                if (payload.phase === 'complete') {
                  setCollisionDone(true)
                  setPhase('done')
                  saveToHistory()
                }
                break
            }
          } catch { /* skip malformed event */ }
        }
      }
    } catch { /* network error — spinner will stop via finally */ }
    finally {
      setIsAnalyzing(false)
    }
  }, [saveToHistory])

  // ── Follow-up chat streaming ────────────────────────────────────────────────
  const runFollowUp = useCallback(async (
    contextInput: string,
    diagnosis: Diagnosis,
    targetAdvisors: AdvisorName[] | null,
    tier: string,
  ) => {
    setIsChatGenerating(true)
    try {
      const response = await fetch('/api/decisions/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: contextInput,
          diagnosis,
          probeAnswers: {},
          tier,
          outputMode: 'concise',
          targetAdvisors: targetAdvisors ?? undefined
        }),
      })

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      if (!reader) return

      let buffer = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (let li = 0; li < lines.length; li++) {
          const line = lines[li]
          if (!line.startsWith('event: ')) continue
          const event = line.slice(7).trim()
          const dataLine = lines[li + 1]
          if (!dataLine?.startsWith('data: ')) continue
          try {
            const payload = JSON.parse(dataLine.slice(6))
            switch (event) {
              case 'advisor_start': {
                const msgId = newId()
                setChatCurrentAdvisor(payload.advisor)
                setChatMessages(prev => [...prev, { id: msgId, type: 'advisor', advisor: payload.advisor, content: '', veto: false, done: false }])
                break
              }
              case 'advisor_chunk':
                setChatMessages(prev => prev.map(m =>
                  m.type === 'advisor' && m.advisor === payload.advisor && !m.done
                    ? { ...m, content: m.content + payload.chunk } : m
                ))
                break
              case 'advisor_done':
                setChatMessages(prev => prev.map(m =>
                  m.type === 'advisor' && m.advisor === payload.advisor && !m.done
                    ? { ...m, done: true, veto: payload.veto } : m
                ))
                setChatCurrentAdvisor(null)
                break
              case 'collision_chunk':
                setChatMessages(prev => {
                  const last = prev[prev.length - 1]
                  if (last?.type === 'collision') {
                    return [...prev.slice(0, -1), { ...last, content: last.content + payload.chunk }]
                  }
                  return [...prev, { id: newId(), type: 'collision', content: payload.chunk, done: false }]
                })
                break
              case 'phase':
                if (payload.phase === 'complete') {
                  setChatMessages(prev => prev.map(m => m.type === 'collision' ? { ...m, done: true } : m))
                }
                break
            }
          } catch { /* skip malformed event */ }
        }
      }
    } catch { /* network error — spinner stops via finally */ }
    finally {
      setIsChatGenerating(false)
    }
  }, [])

  // ── Start initial analysis ─────────────────────────────────────────────────
  const startAnalysis = useCallback(async (skipProbes = false) => {
    if (!data) return
    const answers = skipProbes ? {} : probeAnswers
    setPhase('analyzing')
    await runInitialAnalysis(data.input, data.diagnosis, answers, data.engineTier, outputMode, data.historyContext)
  }, [data, probeAnswers, outputMode, runInitialAnalysis])

  // ── Handle follow-up ───────────────────────────────────────────────────────
  const handleFollowUp = useCallback(async (text: string, targets: AdvisorName[] | null) => {
    if (!data) return
    setChatMessages(prev => [...prev, { id: newId(), type: 'user', content: text }])

    // 1. 初始分析摘要（让顾问记得自己说过什么）
    const initialSummary = advisorStatements
      .filter(s => s.done && s.content)
      .map(s => `【${ADVISORS[s.advisor]?.displayName}初始观点】${s.content.slice(0, 250)}`)
      .join('\n\n')

    // 2. 本轮追问对话历史（最近 4 条顾问回复）
    const prevAdvisorMsgs = chatMessages.filter(m => m.type === 'advisor') as Extract<FollowUpMessage, { type: 'advisor' }>[]
    const chatSummary = prevAdvisorMsgs
      .filter(m => m.done && m.content)
      .slice(-4)
      .map(m => `【${ADVISORS[m.advisor]?.displayName}追问回复】${m.content.slice(0, 200)}`)
      .join('\n\n')

    // 3. 拼装完整上下文
    const parts = [
      `【原始问题】${data.input}`,
      initialSummary ? `【顾问初始分析摘要】\n${initialSummary}` : '',
      chatSummary ? `【本轮追问记录】\n${chatSummary}` : '',
      `【用户补充/追问】${text}`,
    ].filter(Boolean).join('\n\n')

    const effectiveTargets = targets ?? data.diagnosis.activatedAdvisors.slice(0, 3)
    await runFollowUp(parts, data.diagnosis, effectiveTargets, data.engineTier)
  }, [data, advisorStatements, chatMessages, runFollowUp])

  // ── Generate action plan (isUpdate=true 时纳入追问上下文) ─────────────────
  const generateActionPlan = useCallback(async (isUpdate = false) => {
    if (!data) return
    setIsExporting(true)
    try {
      const followUpMsgs = chatMessages
        .filter(m => m.type === 'advisor' && (m as Extract<FollowUpMessage, { type: 'advisor' }>).done)
        .slice(isUpdate ? -6 : -3) as Extract<FollowUpMessage, { type: 'advisor' }>[]
      const followUpSummary = followUpMsgs.length > 0
        ? followUpMsgs.map(m => `${ADVISORS[m.advisor]?.displayName}：${m.content.slice(0, 200)}`).join('\n')
        : undefined

      const res = await fetch('/api/decisions/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          coreQuestion: data.diagnosis.coreQuestion,
          originalInput: data.input,
          advisorStatements: advisorStatements.map(s => ({
            advisor: s.advisor,
            displayName: ADVISORS[s.advisor]?.displayName ?? s.advisor,
            content: s.content,
            veto: s.veto,
          })),
          collisionContent,
          verdict: savedVerdictContent || undefined,
          followUpSummary,
        }),
      })
      const json = await res.json()
      if (json.ok) {
        setActionPlan(json.actionPlan)
        // Action plan is persisted via the next saveToHistory call (included in analysis JSON)
        // 更新方案时不自动弹窗，用户留在当前页继续看
        if (!isUpdate) { /* 初次生成也不弹窗，内联展示 */ }
      } else if (isUpdate) {
        alert(`更新失败：${json.error || '请检查 API Key 配置'}`)
      }
    } catch (err) {
      if (isUpdate) alert(`网络错误：${String(err)}`)
    } finally {
      setIsExporting(false)
    }
  }, [data, advisorStatements, collisionContent, savedVerdictContent, chatMessages, id])

  // 打开完整方案弹窗（PDF）
  const handleViewPlan = useCallback(() => {
    if (actionPlan) setShowPrintModal(true)
  }, [actionPlan])

  // 兼容旧引用
  const handleExport = handleViewPlan

  // ── Delete decision ────────────────────────────────────────────────────────
  const handleDeleteDecision = useCallback(async () => {
    if (!confirm('删除后不留任何痕迹，确定吗？')) return
    // Clear sessionStorage
    sessionStorage.removeItem(`decision-${id}`)
    sessionStorage.removeItem(`analysis-${id}`)
    // Delete from Supabase
    try {
      const supabase = createClient()
      await supabase.from('decisions').delete().eq('id', id)
    } catch { /* ignore */ }
    setShowPrintModal(false)
    router.push('/')
  }, [id, router])

  // ── Verdict ────────────────────────────────────────────────────────────────
  const handleSaveVerdict = () => {
    const tag = verdictTag.trim()
    const text = verdictText.trim()
    if (!tag && !text) return
    const combined = tag && text ? `${tag} · ${text}` : tag || text
    const stored = sessionStorage.getItem(`decision-${id}`)
    if (stored) {
      const parsed = JSON.parse(stored)
      sessionStorage.setItem(`decision-${id}`, JSON.stringify({ ...parsed, verdict: combined, verdictAt: new Date().toISOString() }))
    }
    saveToHistory(combined)
    setSavedVerdictContent(combined)
    setVerdictSaved(true)
    setShowVerdictInput(false)

    // 异步更新用户画像（fire-and-forget，不阻断 UI）
    if (user && data) {
      fetch('/api/decisions/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          decisionId: id,
          coreQuestion: data.diagnosis?.coreQuestion ?? '',
          input: data.input ?? '',
          verdict: combined,
        }),
      }).catch(() => { /* 画像更新失败不影响主流程 */ })
    }
  }

  // ── Loading / Error states ─────────────────────────────────────────────────
  if (notFound) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center px-5 gap-6">
        <p className="text-[var(--muted-foreground)] text-center">找不到这条决策记录。<br /><span className="text-xs">可能是刷新了页面，或会话已过期。</span></p>
        <Button onClick={() => router.push('/')} className="bg-[var(--primary)] text-white">重新开始</Button>
      </main>
    )
  }

  if (!data) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="flex gap-1.5">{[0,1,2].map(i => <div key={i} className="w-2 h-2 rounded-full bg-[var(--primary)] animate-bounce" style={{ animationDelay: `${i*0.15}s` }} />)}</div>
      </main>
    )
  }

  const activatedAdvisors = data.diagnosis.activatedAdvisors
  const analysisComplete = phase === 'done' && collisionDone

  return (
    <main className="min-h-screen flex flex-col">

      {/* ── Fixed header ─────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-40 bg-[var(--background)]/95 backdrop-blur-sm border-b border-[var(--border)]">
        <div className="max-w-[720px] mx-auto px-4 sm:px-5 h-12 flex items-center justify-between">
          <button onClick={() => router.push('/')} className="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors">← 返回</button>
          <h2 className="text-sm font-medium truncate mx-4 max-w-[60%]" title={data.diagnosis.coreQuestion}>
            {data.diagnosis.coreQuestion}
          </h2>
          <button onClick={() => window.open('/history', '_blank')} className="text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors flex-shrink-0">
            历史
          </button>
        </div>
      </div>

      {/* ── Probing phase ────────────────────────────────────────────────────── */}
      {phase === 'probing' && (
        <div className="flex-1 max-w-[680px] mx-auto w-full px-4 sm:px-5 py-8">

          {data.diagnosis.trapDetected && (
            <div className="mb-6 p-4 border-l-4 border-[var(--destructive)] bg-red-50 rounded-r-lg">
              <p className="font-bold text-[var(--destructive)] mb-1">⚠ 检测到前置风险</p>
              <p className="text-sm">{data.diagnosis.trapDescription}</p>
            </div>
          )}

          {data.diagnosis.contextSummary?.length > 0 && (
            <div className="rounded-lg border border-[var(--border)] bg-white px-5 py-4 mb-8">
              <p className="text-xs text-[var(--muted-foreground)] mb-3 tracking-wide">顾问目前了解到</p>
              <ul className="space-y-1.5">
                {data.diagnosis.contextSummary.map((fact, i) => (
                  <li key={i} className="flex gap-2.5 items-start">
                    <span className="mt-1.5 w-1 h-1 rounded-full bg-[var(--primary)] flex-shrink-0" />
                    <span className="text-sm leading-relaxed">{fact}</span>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-[var(--muted-foreground)] mt-3">如果理解有偏差，可以在下方补充说明</p>
            </div>
          )}

          <div className="mb-8">
            <p className="text-xs text-[var(--muted-foreground)] mb-3">分析深度</p>
            <div className="flex gap-2">
              {([{ key: 'detailed', label: '完整圆桌', desc: '顾问开会，展示碰撞过程' }, { key: 'concise', label: '精要判断', desc: '直接给结论，节省时间' }] as const).map(({ key, label, desc }) => (
                <button key={key} onClick={() => setOutputMode(key)} className={`flex-1 text-left px-4 py-3 rounded-lg border transition-colors ${outputMode === key ? 'border-[var(--primary)] bg-[var(--primary)]/5 text-[var(--primary)]' : 'border-[var(--border)] text-[var(--muted-foreground)] hover:border-[var(--primary)]/40'}`}>
                  <div className="text-sm font-medium">{label}</div>
                  <div className="text-xs mt-0.5 text-[var(--muted-foreground)]">{desc}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="mb-8">
            <p className="text-xs text-[var(--muted-foreground)] mb-3">本次激活的顾问</p>
            <div className="flex gap-2 flex-wrap">
              {activatedAdvisors.map((name) => {
                const a = ADVISORS[name]
                return <span key={name} className="text-xs px-2.5 py-1 rounded-md border" style={{ borderColor: a?.color, color: a?.color }}>{a?.displayName}</span>
              })}
            </div>
          </div>

          {data.diagnosis.probes.length > 0 && (
            <div className="space-y-6 mb-8">
              <p className="text-sm">还有几个问题会影响判断——<span className="text-[var(--muted-foreground)] text-xs ml-1">（可以跳过）</span></p>
              {data.diagnosis.probes.map((probe, i) => {
                const options = data.diagnosis.probeOptions?.[i] ?? []
                const cur = probeAnswers[`probe_${i}`] || ''
                return (
                  <div key={i} className="space-y-2">
                    <label className="text-sm font-medium block leading-relaxed">{probe}</label>
                    {options.length > 0 && (
                      <div className="flex gap-2 flex-wrap">
                        {options.map((opt) => (
                          <button key={opt} onClick={() => setProbeAnswers(prev => ({ ...prev, [`probe_${i}`]: cur === opt ? '' : opt }))}
                            className={`text-xs px-3 py-1.5 rounded-full border transition-all ${cur === opt ? 'border-[var(--primary)] bg-[var(--primary)] text-white' : 'border-[var(--border)] text-[var(--muted-foreground)] hover:border-[var(--primary)]/50'}`}>
                            {opt}
                          </button>
                        ))}
                      </div>
                    )}
                    <Textarea placeholder="或者用自己的话说…" value={options.includes(cur) ? '' : cur}
                      onChange={(e) => setProbeAnswers(prev => ({ ...prev, [`probe_${i}`]: e.target.value }))}
                      onFocus={() => { if (options.includes(probeAnswers[`probe_${i}`])) setProbeAnswers(prev => ({ ...prev, [`probe_${i}`]: '' })) }}
                      className="min-h-[48px] text-sm bg-white border-[var(--border)] resize-none rounded-lg" />
                  </div>
                )
              })}
            </div>
          )}

          <div className="space-y-3">
            <Button onClick={() => startAnalysis(false)} className="w-full h-11 bg-[var(--primary)] hover:bg-[#1E3A5F] text-white">召集顾问，开始分析</Button>
            {data.diagnosis.probes.length > 0 && (
              <button onClick={() => startAnalysis(true)} className="w-full text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors py-1">
                跳过这些问题，直接开始 →
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Analysis + Follow-up phase ───────────────────────────────────────── */}
      {(phase === 'analyzing' || phase === 'done') && (
        <div className="flex-1 max-w-[680px] mx-auto w-full px-4 sm:px-5 py-8 pb-6">

          {/* ── 决策模式标签（服务端自动识别，分析开始后显示）─────────────────── */}
          {decisionMode && (
            <div className="mb-4 flex items-center gap-2">
              <span className="text-[10px] text-[var(--muted-foreground)] tracking-widest uppercase">决策模式</span>
              <span
                className="text-[11px] px-2.5 py-0.5 rounded-full border font-semibold tracking-wide"
                style={{
                  color: decisionMode.modeLabel.color,
                  borderColor: decisionMode.modeLabel.color + '40',
                  backgroundColor: decisionMode.modeLabel.color + '0f',
                }}
              >
                {decisionMode.modeLabel.label} · {decisionMode.modeLabel.desc}
              </span>
            </div>
          )}

          {/* ── 被看见 seenMoment ─────────────────────────────────────────────── */}
          {data.diagnosis.seenMoment && (
            <div className="mb-6 px-5 py-4 rounded-xl border border-[var(--border)] bg-[#fafaf9]">
              <p style={{ fontFamily: 'Georgia, "Times New Roman", serif', fontSize: '14px', lineHeight: '1.8', color: '#6b6560', fontStyle: 'italic', fontWeight: 400 }}>「{data.diagnosis.seenMoment}」</p>
            </div>
          )}

          {/* ── Advisor sections (document style) ─────────────────────────────── */}
          {advisorStatements.map((stmt) => (
            <AdvisorSection
              key={stmt.advisor}
              stmt={stmt}
              isActive={stmt.advisor === currentAdvisor && !stmt.done}
            />
          ))}

          {/* ── Collision section ─────────────────────────────────────────────── */}
          {(collisionContent || isAnalyzing) && advisorStatements.length > 0 && (
            <CollisionSection content={mainCollisionContent} done={collisionDone} />
          )}

          {/* ── 行动方案内联展示（顾问发言后紧接） ──────────────────────────── */}
          {analysisComplete && (
            <div ref={planCardRef} className="mt-2 mb-2">
              {isExporting && !actionPlan ? (
                <div className="rounded-xl border border-[#9A7B4F]/25 bg-[#9A7B4F]/5 px-5 py-5 flex items-center gap-3 mb-6">
                  <span className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin flex-shrink-0" style={{ borderColor: '#9A7B4F', borderTopColor: 'transparent' }} />
                  <span className="text-sm" style={{ color: '#7A5C2E' }}>顾问们正在整理行动方案…</span>
                </div>
              ) : actionPlan ? (
                <ActionPlanCard
                  plan={actionPlan}
                  onView={handleViewPlan}
                  onUpdate={() => generateActionPlan(true)}
                  hasFollowUp={chatMessages.filter(m => m.type === 'user').length > 0}
                  isUpdating={isExporting}
                />
              ) : null}
            </div>
          )}

          {/* ── 记录决定（看完方案后） ──────────────────────────────────────── */}
          {analysisComplete && (
            <div className="mt-2 mb-8">
              {!verdictSaved && !showVerdictInput && (
                <div className="flex flex-col items-center gap-2">
                  <button
                    onClick={() => setShowVerdictInput(true)}
                    className="text-sm px-7 py-2.5 rounded-lg bg-[var(--primary)] text-white hover:bg-[#1E3A5F] transition-colors font-medium tracking-wide"
                  >
                    {userName ? `${userName}，落笔记录` : '落笔，记录我的决定'}
                  </button>
                  <p className="text-[11px] text-[var(--muted-foreground)]/70 leading-relaxed text-center">
                    每次记录，顾问越来越懂你
                  </p>
                </div>
              )}

              {showVerdictInput && !verdictSaved && (() => {
                const VERDICT_CHIPS = [
                  { label: '决定执行', icon: '↗', color: '#15803d', bg: '#dcfce7', borderOff: '#e2e8f0', borderOn: '#16a34a', placeholder: '例如：认同方案核心，会从第一步开始推进…' },
                  { label: '有所保留', icon: '〜', color: '#b45309', bg: '#fef3c7', borderOff: '#e2e8f0', borderOn: '#d97706', placeholder: '例如：方向认同，但对某一点仍有疑虑…' },
                  { label: '再想想',   icon: '↺', color: '#1d4ed8', bg: '#dbeafe', borderOff: '#e2e8f0', borderOn: '#2563eb', placeholder: '例如：还需要确认一个关键信息再决定…' },
                  { label: '决定不做', icon: '○', color: '#374151', bg: '#f3f4f6', borderOff: '#e2e8f0', borderOn: '#6b7280', placeholder: '例如：综合权衡后，这个时机不合适…' },
                ] as const
                const active = VERDICT_CHIPS.find(c => c.label === verdictTag)
                const canSave = !!verdictTag || !!verdictText.trim()
                return (
                  <div className="rounded-lg border border-[var(--border)] bg-white p-4 space-y-3">
                    {/* 快捷选项 */}
                    <div>
                      <p className="text-[11px] text-[var(--muted-foreground)] mb-2">你的决定是</p>
                      <div className="flex flex-wrap gap-2">
                        {VERDICT_CHIPS.map(chip => {
                          const selected = verdictTag === chip.label
                          return (
                            <button
                              key={chip.label}
                              onClick={() => setVerdictTag(prev => prev === chip.label ? '' : chip.label)}
                              className="text-xs px-3 py-1.5 rounded-full border transition-all flex items-center gap-1.5"
                              style={selected
                                ? { backgroundColor: chip.bg, borderColor: chip.borderOn, color: chip.color, fontWeight: 600, boxShadow: `0 0 0 1.5px ${chip.borderOn}40` }
                                : { backgroundColor: 'transparent', borderColor: chip.borderOff, color: 'var(--muted-foreground)' }
                              }
                            >
                              <span className="leading-none" style={{ fontSize: '11px', opacity: selected ? 1 : 0.5 }}>{chip.icon}</span>
                              {chip.label}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                    {/* 文字描述 */}
                    <textarea
                      value={verdictText}
                      onChange={(e) => setVerdictText(e.target.value)}
                      placeholder={active?.placeholder ?? '具体说说你的想法，对哪点认同，对哪点保留…'}
                      rows={2}
                      className="w-full text-sm bg-[var(--muted)]/30 border border-[var(--border)] rounded-lg px-4 py-3 resize-none focus:outline-none focus:border-[var(--primary)] transition-colors"
                    />
                    <p className="text-[10px] text-[var(--muted-foreground)]/60 -mt-1">描述越具体，顾问越懂你</p>
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => { setShowVerdictInput(false); setVerdictTag(''); setVerdictText('') }} className="text-xs text-[var(--muted-foreground)] px-3 py-1.5">取消</button>
                      <button onClick={handleSaveVerdict} disabled={!canSave} className="text-xs bg-[var(--primary)] text-white px-5 py-1.5 rounded-lg disabled:opacity-40 transition-colors font-medium tracking-wide">
                        落笔存档
                      </button>
                    </div>
                  </div>
                )
              })()}

              {verdictSaved && savedVerdictContent && (() => {
                const TAG_META: Record<string, { icon: string; color: string; bg: string; border: string }> = {
                  '决定执行': { icon: '↗', color: '#15803d', bg: '#dcfce7', border: '#16a34a' },
                  '有所保留': { icon: '〜', color: '#b45309', bg: '#fef3c7', border: '#d97706' },
                  '再想想':   { icon: '↺', color: '#1d4ed8', bg: '#dbeafe', border: '#2563eb' },
                  '决定不做': { icon: '○', color: '#374151', bg: '#f3f4f6', border: '#6b7280' },
                }
                let tag = ''
                let text = savedVerdictContent
                for (const t of Object.keys(TAG_META)) {
                  if (savedVerdictContent === t) { tag = t; text = ''; break }
                  if (savedVerdictContent.startsWith(t + ' · ')) { tag = t; text = savedVerdictContent.slice(t.length + 3); break }
                }
                const tm = tag ? TAG_META[tag] : null

                // 7天后复盘日期
                const followUpDate = (() => {
                  const stored = sessionStorage.getItem(`decision-${id}`)
                  if (stored) {
                    try {
                      const parsed = JSON.parse(stored)
                      const base = parsed.verdictAt ? new Date(parsed.verdictAt) : new Date()
                      const d = new Date(base.getTime() + 7 * 24 * 60 * 60 * 1000)
                      return `${d.getMonth() + 1}月${d.getDate()}日`
                    } catch { /* ignore */ }
                  }
                  const d = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
                  return `${d.getMonth() + 1}月${d.getDate()}日`
                })()

                return (
                  <div className="space-y-3">
                    {/* 决定存档卡 */}
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-5 py-5">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-[10px] text-emerald-500 tracking-widest font-semibold uppercase">已存档</span>
                        {tm && (
                          <span className="text-[11px] px-2.5 py-0.5 rounded-full border flex-shrink-0 font-semibold flex items-center gap-1"
                            style={{ color: tm.color, backgroundColor: tm.bg, borderColor: tm.border }}>
                            <span style={{ fontSize: '10px' }}>{tm.icon}</span>
                            {tag}
                          </span>
                        )}
                      </div>
                      {text && (
                        <p className="text-[15px] leading-relaxed text-emerald-900 font-medium"
                          style={{ fontFamily: 'Georgia, "Times New Roman", serif', fontStyle: 'italic' }}>
                          「{text}」
                        </p>
                      )}
                      {!text && !tm && (
                        <p className="text-[15px] leading-relaxed text-emerald-900 font-medium"
                          style={{ fontFamily: 'Georgia, "Times New Roman", serif', fontStyle: 'italic' }}>
                          「{savedVerdictContent}」
                        </p>
                      )}
                      {!text && tm && (
                        <p className="text-xs text-emerald-600/70 mt-1">你选择了{tag}，但没有留下文字。</p>
                      )}
                    </div>

                    {/* ── 责任归属：这是你的选择 ─────────────────────────────── */}
                    <div className="rounded-lg border border-[#e5e7eb] bg-[#f9fafb] px-5 py-4 flex items-start gap-3">
                      <span className="text-base mt-0.5 select-none">🧭</span>
                      <div>
                        <p className="text-[12px] font-semibold text-[#374151] mb-0.5">这是你的选择</p>
                        <p className="text-[11px] text-[#6b7280] leading-relaxed">
                          顾问提供了分析框架——但决定权从始至终在你。<br/>
                          选错了，是经验；选对了，是你的判断力。两种结果都属于你。
                        </p>
                      </div>
                    </div>

                    {/* ── 7天后复盘提示 ──────────────────────────────────────── */}
                    <div className="rounded-lg border border-[#e5e7eb] bg-[#f9fafb] px-5 py-4 flex items-start gap-3">
                      <span className="text-base mt-0.5 select-none">📅</span>
                      <div>
                        <p className="text-[12px] font-semibold text-[#374151] mb-0.5">
                          {followUpDate}，回来看看结果
                        </p>
                        <p className="text-[11px] text-[#6b7280] leading-relaxed">
                          7天后，来历史记录里写下这个决定的进展——
                          好的决定值得被记录，坏的决定更值得被复盘。
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })()}
            </div>
          )}

          {/* ── 收尾情绪卡片 ──────────────────────────────────────────────────── */}
          {closingText && (
            <div className="mx-auto max-w-[460px] my-6 px-6 py-5 rounded-2xl border border-[var(--border)] bg-[#fafaf9] text-center">
              <p style={{ fontFamily: 'Georgia, "Times New Roman", serif', fontSize: '14px', lineHeight: '1.9', color: '#6b6560', fontStyle: 'italic', fontWeight: 400 }}>「{closingText}」</p>
            </div>
          )}

          {/* ── Divider before follow-up chat ─────────────────────────────────── */}
          {analysisComplete && (
            <div className="flex items-center gap-3 mb-6">
              <div className="h-px flex-1 bg-[var(--border)]" />
              <span className="text-xs text-[var(--muted-foreground)]/70 tracking-wide">继续追问顾问 · 仅限本次决策相关</span>
              <div className="h-px flex-1 bg-[var(--border)]" />
            </div>
          )}

          {/* ── Follow-up chat messages ────────────────────────────────────────── */}
          {chatMessages.map((msg) => {
            if (msg.type === 'user') return <UserBubble key={msg.id} content={msg.content} />
            if (msg.type === 'advisor') return (
              <AdvisorBubble
                key={msg.id}
                msg={msg}
                isActive={msg.advisor === chatCurrentAdvisor && !msg.done}
              />
            )
            if (msg.type === 'collision') return <FollowUpCollisionBubble key={msg.id} msg={msg} />
            if (msg.type === 'verdict') return <VerdictBubble key={msg.id} content={msg.content} />
            return null
          })}

          <div ref={bottomRef} className="h-4" />
        </div>
      )}

      {/* ── Fixed bottom: follow-up input (only shown after analysis completes) ── */}
      {analysisComplete && (
        <div className="sticky bottom-0 bg-[var(--background)]/95 backdrop-blur-sm border-t border-[var(--border)]" style={{ overflow: 'visible' }}>
          <div className="max-w-[680px] mx-auto px-4 sm:px-5 py-2.5" style={{ overflow: 'visible' }}>
            <ChatInput
              onSend={handleFollowUp}
              disabled={isChatGenerating}
              activatedAdvisors={activatedAdvisors}
              decisionId={id}
              coreQuestion={data.diagnosis.coreQuestion}
              onExport={handleExport}
              isExporting={isExporting}
              hasPlan={!!actionPlan}
            />
          </div>
        </div>
      )}

      {/* ── Print Modal ──────────────────────────────────────────────────────── */}
      {showPrintModal && actionPlan && (
        <PrintModal
          plan={actionPlan}
          coreQuestion={data.diagnosis.coreQuestion}
          verdict={savedVerdictContent || undefined}
          advisorStatements={advisorStatements}
          userName={userName || undefined}
          onClose={() => setShowPrintModal(false)}
          onDelete={handleDeleteDecision}
        />
      )}

    </main>
  )
}
