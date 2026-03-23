'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ADVISORS } from '@/types/decision'
import type { AdvisorName } from '@/types/decision'

interface HistoryEntry {
  id: string
  coreQuestion: string
  advisors: AdvisorName[]
  verdict: string | null
  savedAt: string
}

function formatDate(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const time = d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })
  const dDay = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const nowDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const diffDays = Math.round((nowDay.getTime() - dDay.getTime()) / 86400000)
  if (diffDays === 0) return `今天 ${time}`
  if (diffDays === 1) return `昨天 ${time}`
  if (diffDays < 7) return `${diffDays}天前 ${time}`
  return `${d.getMonth() + 1}月${d.getDate()}日 ${time}`
}

export default function HistoryPage() {
  const router = useRouter()
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    try {
      const stored = localStorage.getItem('decision-history')
      if (stored) {
        const all: HistoryEntry[] = JSON.parse(stored)
        // 过滤掉已无对应数据的僵尸记录
        const valid = all.filter(entry =>
          localStorage.getItem(`decision-${entry.id}`) !== null
        )
        // 如果有僵尸记录被清理掉，同步更新 localStorage
        if (valid.length !== all.length) {
          localStorage.setItem('decision-history', JSON.stringify(valid))
        }
        setHistory(valid)
      }
    } catch { /* ignore */ }
    setLoaded(true)
  }, [])

  const clearHistory = () => {
    if (!confirm('清空后不可恢复。确定要让这些记录消失吗？')) return
    history.forEach(h => {
      localStorage.removeItem(`decision-${h.id}`)
      localStorage.removeItem(`analysis-${h.id}`)
    })
    localStorage.removeItem('decision-history')
    setHistory([])
  }

  return (
    <main className="min-h-screen">
      <div className="max-w-[680px] mx-auto px-4 sm:px-5 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={() => router.push('/')}
            className="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
          >
            ← 返回
          </button>
          {history.length > 0 && (
            <button
              onClick={clearHistory}
              className="text-xs text-[var(--muted-foreground)] hover:text-[var(--destructive)] transition-colors"
            >
              清空全部
            </button>
          )}
        </div>

        <div className="mb-8">
          <h1 className="text-xl font-bold">你认真想过的事</h1>
          {history.length > 0 ? (
            <p className="text-sm text-[var(--muted-foreground)] mt-1.5 leading-relaxed">
              每一条，顾问们都认真对待过。<br />
              <span className="text-xs">只在你的设备上，不在任何服务器里。</span>
            </p>
          ) : (
            <p className="text-sm text-[var(--muted-foreground)] mt-1">还没有记录</p>
          )}
        </div>

        {!loaded && (
          <div className="flex gap-1.5 justify-center py-12">
            {[0,1,2].map(i => (
              <div key={i} className="w-2 h-2 rounded-full bg-[var(--primary)] animate-bounce" style={{ animationDelay: `${i*0.15}s` }} />
            ))}
          </div>
        )}

        {loaded && history.length === 0 && (
          <div className="text-center py-20 space-y-4">
            <p className="text-3xl opacity-20">·</p>
            <p className="text-[var(--muted-foreground)] text-sm leading-relaxed">
              认真想过的事，会留在这里。<br />
              <span className="text-xs">当然，你也可以选择让它消失。</span>
            </p>
            <Button onClick={() => router.push('/')} className="bg-[var(--primary)] text-white hover:bg-[#1E3A5F] mt-4">
              说出你想认真对待的事
            </Button>
          </div>
        )}

        {loaded && history.length > 0 && (
          <div className="space-y-3">
            {history.map((entry) => (
              <div
                key={entry.id}
                className="rounded-lg border border-[var(--border)] bg-white px-5 py-4 hover:border-[var(--primary)]/40 transition-colors cursor-pointer"
                onClick={() => router.push(`/decision/${entry.id}`)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium leading-relaxed line-clamp-2">
                      {entry.coreQuestion}
                    </p>

                    {/* Verdict badge */}
                    {entry.verdict ? (() => {
                      const TAG_META: Record<string, { icon: string; color: string; bg: string; border: string }> = {
                        '决定执行': { icon: '↗', color: '#15803d', bg: '#dcfce7', border: '#16a34a' },
                        '有所保留': { icon: '〜', color: '#b45309', bg: '#fef3c7', border: '#d97706' },
                        '再想想':   { icon: '↺', color: '#1d4ed8', bg: '#dbeafe', border: '#2563eb' },
                        '决定不做': { icon: '○', color: '#374151', bg: '#f3f4f6', border: '#6b7280' },
                      }
                      let tag = ''
                      let text = entry.verdict
                      for (const t of Object.keys(TAG_META)) {
                        if (entry.verdict === t) { tag = t; text = ''; break }
                        if (entry.verdict.startsWith(t + ' · ')) { tag = t; text = entry.verdict.slice(t.length + 3); break }
                      }
                      const tm = tag ? TAG_META[tag] : null
                      return (
                        <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                          {tm ? (
                            <span className="text-[10px] px-2 py-0.5 rounded-full border font-semibold flex items-center gap-1 flex-shrink-0"
                              style={{ color: tm.color, backgroundColor: tm.bg, borderColor: tm.border }}>
                              <span>{tm.icon}</span>{tag}
                            </span>
                          ) : (
                            <span className="text-[10px] text-emerald-500 font-semibold">✓</span>
                          )}
                          {text && <span className="text-xs text-emerald-700 line-clamp-1">「{text}」</span>}
                          {!text && !tm && <span className="text-xs text-emerald-700 line-clamp-1">「{entry.verdict}」</span>}
                        </div>
                      )
                    })() : (
                      <div className="mt-1.5 flex items-center gap-1">
                        <span className="text-xs text-amber-500/90">还没记录决定</span>
                        <span className="text-amber-400 text-sm leading-none">›</span>
                      </div>
                    )}

                    {/* Advisors */}
                    <div className="flex gap-1.5 flex-wrap mt-3">
                      {entry.advisors?.slice(0, 4).map((name) => {
                        const advisor = ADVISORS[name]
                        return (
                          <span
                            key={name}
                            className="text-[10px] px-2 py-0.5 rounded border"
                            style={{ borderColor: advisor?.color, color: advisor?.color }}
                          >
                            {advisor?.displayName}
                          </span>
                        )
                      })}
                      {(entry.advisors?.length ?? 0) > 4 && (
                        <span className="text-[10px] text-[var(--muted-foreground)]">+{entry.advisors.length - 4}</span>
                      )}
                    </div>
                  </div>

                  <span className="text-xs text-[var(--muted-foreground)] flex-shrink-0 mt-0.5">
                    {formatDate(entry.savedAt)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Note */}
        {loaded && history.length > 0 && (
          <p className="text-center text-xs text-[var(--muted-foreground)] mt-10 leading-relaxed">
            这些只在你的设备上 · 不同步到任何地方
          </p>
        )}

      </div>
    </main>
  )
}
