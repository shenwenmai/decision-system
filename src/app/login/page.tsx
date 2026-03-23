'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'

export default function LoginPage() {
  const { signInWithGoogle, signInWithEmail, signUpWithEmail } = useAuth()
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

        {/* Google 登录 */}
        <button
          onClick={signInWithGoogle}
          className="w-full flex items-center justify-center gap-3 py-2.5 px-4 rounded-lg border border-[var(--border)] bg-white hover:bg-gray-50 transition-colors text-sm font-medium"
        >
          <svg width="18" height="18" viewBox="0 0 48 48">
            <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.2l6.7-6.7C35.7 2.4 30.2 0 24 0 14.7 0 6.7 5.4 2.7 13.3l7.8 6C12.4 13.2 17.7 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h12.7c-.5 2.9-2.2 5.4-4.7 7l7.3 5.7c4.3-4 6.8-9.8 6.8-16.7z"/>
            <path fill="#FBBC05" d="M10.5 28.7A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.8-4.7l-7.8-6A23.9 23.9 0 0 0 0 24c0 3.8.9 7.5 2.5 10.7l8-6z"/>
            <path fill="#34A853" d="M24 48c6.2 0 11.4-2 15.2-5.5l-7.3-5.7c-2 1.4-4.6 2.2-7.9 2.2-6.3 0-11.6-3.7-13.5-9.3l-8 6.2C6.7 42.6 14.7 48 24 48z"/>
          </svg>
          使用 Google 登录
        </button>

        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-[var(--border)]" />
          <span className="text-xs text-[var(--muted-foreground)]">或</span>
          <div className="flex-1 h-px bg-[var(--border)]" />
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
