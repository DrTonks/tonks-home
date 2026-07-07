import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * 合并 Tailwind class，处理冲突（cn('px-2', 'px-4') → 'px-4'）
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * 格式化 Unix 时间戳（秒）为本地时间字符串
 */
export function formatTimestamp(ts: number | null | undefined): string {
  if (!ts) return '未知'
  const d = new Date(ts * 1000)
  return d.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * 计算时间戳距现在多久（"3 分钟前"）
 */
export function timeAgo(ts: number | null | undefined): string {
  if (!ts) return '未知'
  const diff = Date.now() - ts * 1000
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return `${sec} 秒前`
  if (sec < 3600) return `${Math.floor(sec / 60)} 分钟前`
  if (sec < 86400) return `${Math.floor(sec / 3600)} 小时前`
  if (sec < 2592000) return `${Math.floor(sec / 86400)} 天前`
  return formatTimestamp(ts)
}

/**
 * 格式化音频时间（秒 → m:ss）
 */
export function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

/**
 * 防抖
 */
export function debounce<T extends (...args: any[]) => void>(fn: T, delay = 300) {
  let timer: ReturnType<typeof setTimeout>
  return (...args: Parameters<T>) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), delay)
  }
}

/**
 * 检测移动端
 */
export function isMobile(): boolean {
  if (typeof window === 'undefined') return false
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
}
