'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  ADVISORS, DEFAULT_SETTINGS, loadSettings, saveSettings,
  type UserSettings, type ConcernTag, type AdvisorName,
} from '@/types/decision'
import AdvisorAvatar from '@/components/AdvisorAvatar'

const CONCERN_TAGS: ConcernTag[] = ['财务风险', '职业发展', '人际关系', '家庭', '健康', '创业', '投资', '时间精力']

// ─── Reusable primitives ────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-5 pt-7 pb-2">
      <h2 className="text-[11px] font-semibold tracking-widest text-[var(--muted-foreground)] uppercase">{children}</h2>
    </div>
  )
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-[var(--border)] last:border-b-0">
      <div className="flex-1 min-w-0">
        <p className="text-sm text-[var(--foreground)]">{label}</p>
        {hint && <p className="text-xs text-[var(--muted-foreground)] mt-0.5 leading-relaxed">{hint}</p>}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  )
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!on)}
      className={`relative w-11 h-6 rounded-full transition-colors ${on ? 'bg-[var(--primary)]' : 'bg-[var(--border)]'}`}
    >
      <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${on ? 'translate-x-5' : 'translate-x-0'}`} />
    </button>
  )
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-5 bg-white rounded-xl border border-[var(--border)] overflow-hidden">
      {children}
    </div>
  )
}

function AdvisorRow({
  advisor, pinned, onTogglePin, isLast
}: {
  advisor: import('@/types/decision').Advisor
  pinned: boolean
  onTogglePin: (name: AdvisorName) => void
  isLast: boolean
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className={!isLast ? 'border-b border-[var(--border)]' : ''}>
      <div className="flex items-center gap-3 px-5 py-3.5">
        <AdvisorAvatar advisor={advisor} size={24} ring />
        {/* 点击名字/角色展开介绍 */}
        <button
          onClick={() => setOpen(v => !v)}
          className="flex-1 min-w-0 flex items-center gap-2 text-left"
        >
          <span className="text-sm font-medium text-[var(--foreground)]">{advisor.displayName}</span>
          <span className="text-xs text-[var(--muted-foreground)] truncate">{advisor.role}</span>
        </button>
        {/* 固定图钉 */}
        <button
          onClick={() => onTogglePin(advisor.name)}
          title={pinned ? '取消固定' : '设为固定出场'}
          className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${
            pinned
              ? 'text-[var(--primary)] bg-[var(--primary)]/8'
              : 'text-[var(--muted-foreground)] hover:text-[var(--primary)] hover:bg-[var(--primary)]/5'
          }`}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill={pinned ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/>
          </svg>
        </button>
        {/* 展开箭头 */}
        <button onClick={() => setOpen(v => !v)} className="text-[var(--muted-foreground)] flex-shrink-0">
          <svg
            width="14" height="14" viewBox="0 0 14 14" fill="none"
            className={`transition-transform ${open ? 'rotate-180' : ''}`}
          >
            <path d="M2.5 5l4.5 4 4.5-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>
      {open && (
        <div className="px-5 pb-4 pt-0">
          <p className="text-xs text-[var(--muted-foreground)] leading-relaxed pl-5 border-l-2" style={{ borderColor: advisor.color }}>
            {advisor.detail}
          </p>
        </div>
      )}
    </div>
  )
}

function DangerButton({ label, hint, onClick }: { label: string; hint: string; onClick: () => void }) {
  return (
    <div className="mx-5">
      <button
        onClick={onClick}
        className="w-full text-left px-5 py-4 rounded-xl border border-[var(--border)] bg-white hover:border-red-200 hover:bg-red-50/40 transition-colors group"
      >
        <p className="text-sm text-[var(--destructive)] font-medium">{label}</p>
        <p className="text-xs text-[var(--muted-foreground)] mt-0.5">{hint}</p>
      </button>
    </div>
  )
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const router = useRouter()
  const [s, setS] = useState<UserSettings>(DEFAULT_SETTINGS)
  const [saved, setSaved] = useState(false)

  useEffect(() => { setS(loadSettings()) }, [])

  const update = <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => {
    setS(prev => {
      const next = { ...prev, [key]: value }
      saveSettings(next)
      return next
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  const toggleConcern = (tag: ConcernTag) => {
    const next = s.concerns.includes(tag)
      ? s.concerns.filter(t => t !== tag)
      : [...s.concerns, tag]
    update('concerns', next)
  }

  const togglePinned = (name: AdvisorName) => {
    const next = s.pinnedAdvisors.includes(name)
      ? s.pinnedAdvisors.filter(n => n !== name)
      : [...s.pinnedAdvisors, name]
    update('pinnedAdvisors', next)
  }

  const clearAllData = () => {
    if (!confirm('这会清除所有决策记录、分析内容和设置。清空后不可恢复，确定吗？')) return
    // Clear all decision data
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('decision-') || key.startsWith('analysis-')) {
        localStorage.removeItem(key)
      }
    })
    localStorage.removeItem('decision-history')
    router.push('/')
  }


  return (
    <main className="min-h-screen pb-16">
      <div className="max-w-[560px] mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-8 pb-2">
          <button onClick={() => router.back()} className="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors">
            ← 返回
          </button>
          <span className={`text-xs transition-opacity duration-300 ${saved ? 'opacity-100 text-emerald-600' : 'opacity-0'}`}>
            已保存
          </span>
        </div>

        <div className="px-5 pt-4 pb-6">
          <h1 className="text-xl font-bold">设置</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">你的偏好自动保存在本设备上</p>
        </div>

        {/* ── 第一层：你的档案 ── */}
        <SectionTitle>你的档案</SectionTitle>
        <Card>
          <Row label="姓名" hint="顾问会用你的名字称呼你">
            <input
              type="text"
              value={s.name}
              onChange={e => update('name', e.target.value)}
              placeholder="输入姓名"
              className="text-sm text-right bg-transparent outline-none text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] w-28"
            />
          </Row>
          <Row label="职业 / 身份" hint="帮助顾问调整分析角度">
            <input
              type="text"
              value={s.occupation}
              onChange={e => update('occupation', e.target.value)}
              placeholder="如：创业者、HR 总监"
              className="text-sm text-right bg-transparent outline-none text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] w-36"
            />
          </Row>
        </Card>

        {/* 常见顾虑方向 */}
        <div className="mx-5 mt-3 bg-white rounded-xl border border-[var(--border)] p-5">
          <p className="text-sm text-[var(--foreground)] mb-1">我常在意的方向</p>
          <p className="text-xs text-[var(--muted-foreground)] mb-3">顾问在分析时会主动关注这些维度</p>
          <div className="flex flex-wrap gap-2">
            {CONCERN_TAGS.map(tag => {
              const active = s.concerns.includes(tag)
              return (
                <button
                  key={tag}
                  onClick={() => toggleConcern(tag)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                    active
                      ? 'bg-[var(--primary)] border-[var(--primary)] text-white'
                      : 'border-[var(--border)] text-[var(--foreground)] hover:border-[var(--primary)]/50'
                  }`}
                >
                  {tag}
                </button>
              )
            })}
          </div>
        </div>

        {/* ── 第二层：记忆与隐私 ── */}
        <SectionTitle>记忆与隐私</SectionTitle>
        <Card>
          <Row
            label="保存决策记录"
            hint="分析完成后保存到本设备，可在历史记录中查看"
          >
            <Toggle on={s.saveHistory} onChange={v => update('saveHistory', v)} />
          </Row>
          <Row
            label="顾问参考历史决策"
            hint="让顾问了解你过去的选择方式，给出更有连贯性的建议"
          >
            <Toggle on={s.advisorsReferenceHistory} onChange={v => update('advisorsReferenceHistory', v)} />
          </Row>
          <Row label="历史保留时长" hint={s.saveHistory ? undefined : '需先开启"保存决策记录"'}>
            <select
              value={s.historyRetention}
              onChange={e => update('historyRetention', e.target.value as UserSettings['historyRetention'])}
              disabled={!s.saveHistory}
              className="text-sm bg-transparent text-[var(--foreground)] outline-none cursor-pointer disabled:opacity-40"
            >
              <option value="30d">30 天</option>
              <option value="90d">90 天</option>
              <option value="1y">一年</option>
              <option value="forever">永久</option>
            </select>
          </Row>
        </Card>

        {/* 隐私说明紧跟记忆设置 */}
        <p className="mx-5 mt-2 text-xs text-[var(--muted-foreground)] leading-relaxed">
          数据已加密存储在云端，仅你可见。开启「顾问参考历史」后，顾问会在分析时参考你过去的决策方式。
        </p>

        {/* ── 第三层：顾问偏好 ── */}
        <SectionTitle>顾问偏好</SectionTitle>
        <Card>
          <Row label="默认召集人数" hint="系统也会根据问题类型动态调整">
            <div className="flex gap-1.5">
              {([3, 5, 8] as const).map(n => (
                <button
                  key={n}
                  onClick={() => update('defaultAdvisorCount', n)}
                  className={`w-9 h-8 rounded-lg text-sm font-medium transition-colors ${
                    s.defaultAdvisorCount === n
                      ? 'bg-[var(--primary)] text-white'
                      : 'border border-[var(--border)] text-[var(--foreground)] hover:border-[var(--primary)]/50'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </Row>
        </Card>

        {/* 顾问列表：介绍 + 固定，合并一张卡片 */}
        <div className="mx-5 mt-3 bg-white rounded-xl border border-[var(--border)] overflow-hidden">
          <div className="px-5 py-2.5 border-b border-[var(--border)] bg-[var(--muted)]/30">
            <p className="text-xs text-[var(--muted-foreground)]">点名字了解他如何思考 · 图钉设为固定出场</p>
          </div>
          {Object.values(ADVISORS).map((advisor, idx) => (
            <AdvisorRow
              key={advisor.name}
              advisor={advisor}
              pinned={s.pinnedAdvisors.includes(advisor.name)}
              onTogglePin={togglePinned}
              isLast={idx === Object.values(ADVISORS).length - 1}
            />
          ))}
        </div>

        {/* ── 第四层：分析方式 ── */}
        <SectionTitle>分析方式</SectionTitle>
        <Card>
          <Row
            label="诊断问题"
            hint="分析前向你确认背景信息，让顾问更准确地理解问题"
          >
            <Toggle on={s.showProbeQuestions} onChange={v => update('showProbeQuestions', v)} />
          </Row>
          <Row label="分析详尽程度" hint="影响每位顾问的回复长度和深度">
            <div className="flex gap-1.5">
              {([
                { value: 'brief', label: '简' },
                { value: 'standard', label: '标准' },
                { value: 'deep', label: '详尽' },
              ] as const).map(opt => (
                <button
                  key={opt.value}
                  onClick={() => update('analysisDepth', opt.value)}
                  className={`px-3 h-8 rounded-lg text-xs font-medium transition-colors ${
                    s.analysisDepth === opt.value
                      ? 'bg-[var(--primary)] text-white'
                      : 'border border-[var(--border)] text-[var(--foreground)] hover:border-[var(--primary)]/50'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </Row>
        </Card>

        {/* ── 版本 ── */}
        <SectionTitle>版本</SectionTitle>
        <Card>
          <Row label="当前版本" hint="每天可用 2 次">
            <span className="text-xs px-2.5 py-1 rounded-full bg-[var(--muted)] text-[var(--muted-foreground)] font-medium">体验版</span>
          </Row>
          <Row label="专业版" hint="旗舰级模型，分析更深 · 决策更准，不限次数">
            <button className="text-xs px-3 py-1.5 rounded-lg bg-[var(--primary)] text-white font-medium hover:bg-[#1E3A5F] transition-colors">
              升级
            </button>
          </Row>
        </Card>

        {/* ── 数据管理 ── */}
        <SectionTitle>数据管理</SectionTitle>
        <div className="space-y-2.5">
          {/* 查看后再删，而不是盲删 */}
          <div className="mx-5">
            <button
              onClick={() => window.open('/history', '_blank')}
              className="w-full text-left px-5 py-4 rounded-xl border border-[var(--border)] bg-white hover:border-[var(--primary)]/40 hover:bg-[var(--primary)]/5 transition-colors"
            >
              <p className="text-sm text-[var(--foreground)] font-medium">管理决策历史</p>
              <p className="text-xs text-[var(--muted-foreground)] mt-0.5">查看所有记录后，逐条或批量删除</p>
            </button>
          </div>
          <DangerButton
            label="清除全部数据"
            hint="清空所有决策记录和设置，恢复初始状态，不可撤销"
            onClick={clearAllData}
          />
        </div>


      </div>
    </main>
  )
}
