import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      // 登录链接无效或已过期，带错误信息跳回登录页
      const loginUrl = new URL('/login', origin)
      loginUrl.searchParams.set('error', 'link_expired')
      return NextResponse.redirect(loginUrl.toString())
    }
  } else {
    // 没有 code 参数，可能是直接访问了 callback 地址
    return NextResponse.redirect(`${origin}/login`)
  }

  return NextResponse.redirect(`${origin}/`)
}
