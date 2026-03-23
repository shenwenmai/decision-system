/**
 * DELETE /api/decisions/clear
 *
 * 清除当前登录用户的全部决策记录和用户画像。
 * 由设置页「清除全部数据」按钮调用。
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function DELETE() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ ok: false, reason: 'unauthenticated' }, { status: 401 })
  }

  // 删除所有决策记录（RLS 保证只能删自己的）
  const { error: decisionsErr } = await supabase
    .from('decisions')
    .delete()
    .eq('user_id', user.id)

  if (decisionsErr) {
    console.error('[clear decisions error]', decisionsErr)
    return NextResponse.json({ ok: false, reason: decisionsErr.message }, { status: 500 })
  }

  // 删除用户画像（包含决策DNA、风险偏好等）
  await supabase
    .from('user_profiles')
    .delete()
    .eq('user_id', user.id)

  return NextResponse.json({ ok: true })
}
