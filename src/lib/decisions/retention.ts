/**
 * History Retention Enforcement
 *
 * 根据用户设置的「历史保留时长」自动清除过期的 Supabase 决策记录。
 * 在主页登录后触发一次（用 sessionStorage 防止重复执行）。
 */

import { createClient } from '@/lib/supabase/client'

const RETENTION_DAYS: Record<string, number | null> = {
  '30d':    30,
  '90d':    90,
  '1y':     365,
  'forever': null,   // 永不删除
}

/**
 * 删除 userId 名下早于保留期限的决策记录。
 * 静默执行，失败不影响主流程。
 */
export async function enforceHistoryRetention(
  userId: string,
  retention: string,
): Promise<void> {
  const days = RETENTION_DAYS[retention]
  if (days === null || days === undefined) return   // forever — 跳过

  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)

  try {
    const supabase = createClient()
    await supabase
      .from('decisions')
      .delete()
      .eq('user_id', userId)
      .lt('updated_at', cutoff.toISOString())
  } catch {
    // 静默失败，不阻断 UI
  }
}

/**
 * 每个浏览器 session 只执行一次清理，避免每次刷新都触发。
 */
export function runRetentionOnce(userId: string): void {
  const sessionKey = `retention-checked-${userId}`
  if (typeof sessionStorage === 'undefined') return
  if (sessionStorage.getItem(sessionKey)) return
  sessionStorage.setItem(sessionKey, '1')

  try {
    const settings = JSON.parse(localStorage.getItem('user-settings') || '{}')
    const retention: string = settings.historyRetention ?? 'forever'
    // fire-and-forget
    enforceHistoryRetention(userId, retention)
  } catch {
    // 读取设置失败时静默跳过
  }
}
