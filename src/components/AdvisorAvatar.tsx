'use client'

import { useState } from 'react'
import type { Advisor } from '@/types/decision'

interface AdvisorAvatarProps {
  advisor: Advisor
  size?: number      // px，默认 32
  className?: string
  ring?: boolean     // 是否显示顾问色环
  active?: boolean   // 是否高亮（发言中）
}

export default function AdvisorAvatar({
  advisor,
  size = 32,
  className = '',
  ring = false,
  active = false,
}: AdvisorAvatarProps) {
  const [imgError, setImgError] = useState(false)

  // 首字母：取 displayName 第一个字符
  const initial = advisor.displayName.charAt(0).toUpperCase()

  const ringStyle = ring
    ? { boxShadow: `0 0 0 2px ${advisor.color}${active ? 'CC' : '55'}` }
    : {}

  const sizeStyle = { width: size, height: size, minWidth: size }

  if (advisor.avatar && !imgError) {
    return (
      <img
        src={advisor.avatar}
        alt={advisor.displayName}
        onError={() => setImgError(true)}
        className={`rounded-full object-cover object-top flex-shrink-0 ${className}`}
        style={{ ...sizeStyle, ...ringStyle }}
      />
    )
  }

  // Fallback：顾问色系圆形 + 首字母
  return (
    <div
      className={`rounded-full flex items-center justify-center flex-shrink-0 select-none font-semibold ${className}`}
      style={{
        ...sizeStyle,
        ...ringStyle,
        backgroundColor: advisor.color + '18',
        border: `1.5px solid ${advisor.color}40`,
        color: advisor.color,
        fontSize: Math.round(size * 0.42),
        letterSpacing: '-0.01em',
      }}
    >
      {initial}
    </div>
  )
}
