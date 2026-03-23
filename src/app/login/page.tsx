'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'

export default function LoginPage() {
  const { signInWithEmail, signUpWithEmail } = useAuth()
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const fn = mode === 'signin' ? signInWithEmail : signUpWithEmail
    const { error } = await fn(email, password)
    setLoading(false)
    if (error) setError(error)
    else router.push('/')
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-[var(--background)] px-4">
      <div className="w-full max-w-[360px] space-y-6">

        {/* Logo */}
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold" style={{ fontFamily: 'Noto Serif SC, serif' }}>
            顾问决策系统
          </h1>
          <p className="text-sm text-[var(--muted-foreground)]">
            说出你正在纠结的事，8位顾问帮你看清楚
          </p>
        </div>

        {/* 邮箱登录 */}
        <form onSubmit={handleEmailAuth} className="space-y-3">
          <input
            type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder="邮箱" required
            className="w-full px-3 py-2.5 rounded-lg border border-[var(--border)] bg-white text-sm outline-none focus:border-[var(--primary)] transition-colors"
          />
          <input
            type="password" value={password} onChange={e => setPassword(e.target.value)}
            placeholder="密码（至少6位）" required
            className="w-full px-3 py-2.5 rounded-lg border border-[var(--border)] bg-white text-sm outline-none focus:border-[var(--primary)] transition-colors"
          />
          {error && <p className="text-xs text-red-500">{error}</p>}
          <button
            type="submit" disabled={loading}
            className="w-full py-2.5 rounded-lg bg-[var(--primary)] text-white text-sm font-medium hover:bg-[#1E3A5F] disabled:opacity-60 transition-colors"
          >
            {loading ? '处理中…' : mode === 'signin' ? '登录' : '注册'}
          </button>
        </form>

        <p className="text-center text-xs text-[var(--muted-foreground)]">
          {mode === 'signin' ? '还没有账号？' : '已有账号？'}
          <button onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
            className="ml-1 text-[var(--primary)] hover:underline">
            {mode === 'signin' ? '注册' : '登录'}
          </button>
        </p>

      </div>
    </main>
  )
}
