/**
 * OSS/CDN 配置与回退逻辑
 *
 * 图片优先从 OSS CDN 加载（通过 img.tonks.top），
 * 当 CDN 不可达时自动回退到本地 /assets/ 路径。
 */

export const CDN_BASE = 'https://img.tonks.top/tonkstop'

/**
 * 本地路径 → CDN 路径映射表
 * 只包含已上传到 OSS 的文件。未在此表中的路径视为仅本地。
 * l3 和 d3 合并为同一张 CDN 图（l3-d3.png），各自的本地回退路径不同。
 */
const LOCAL_TO_CDN: Record<string, string> = {
  // 亮色背景
  '/assets/lightbg/l1.png': `${CDN_BASE}/l1.png`,
  '/assets/lightbg/l2.png': `${CDN_BASE}/l2.png`,
  '/assets/lightbg/l3.png': `${CDN_BASE}/l3-d3.png`, // 合并图
  '/assets/lightbg/l4.png': `${CDN_BASE}/l4.png`,
  // 暗色背景
  '/assets/darkbg/d1.png': `${CDN_BASE}/d1.png`,
  '/assets/darkbg/d2.png': `${CDN_BASE}/d2.png`,
  '/assets/darkbg/d3.png': `${CDN_BASE}/l3-d3.png`, // 合并图（同一文件）
  '/assets/darkbg/d4.png': `${CDN_BASE}/d4.png`,
  // 头像
  '/assets/avatar.gif': `${CDN_BASE}/avatar.gif`,
}

/**
 * CDN → 本地回退路径
 * l3-d3.png 被亮/暗两套共用，回退时各走各的本地文件
 */
const CDN_TO_LOCAL: Record<string, string> = {
  [`${CDN_BASE}/l1.png`]: '/assets/lightbg/l1.png',
  [`${CDN_BASE}/l2.png`]: '/assets/lightbg/l2.png',
  [`${CDN_BASE}/l3-d3.png`]: '/assets/lightbg/l3.png', // 默认回退到亮色版
  [`${CDN_BASE}/l4.png`]: '/assets/lightbg/l4.png',
  [`${CDN_BASE}/d1.png`]: '/assets/darkbg/d1.png',
  [`${CDN_BASE}/d2.png`]: '/assets/darkbg/d2.png',
  [`${CDN_BASE}/d4.png`]: '/assets/darkbg/d4.png',
  [`${CDN_BASE}/avatar.gif`]: '/assets/avatar.gif',
}

// --- CDN 不可达标记 ---
let _cdnFailed = false

/** 标记 CDN 不可达（加载失败时调用） */
export function setCdnFailed(failed: boolean): void {
  _cdnFailed = failed
}

/** CDN 当前是否不可达 */
export function isCdnFailed(): boolean {
  return _cdnFailed
}

/**
 * 获取图片的最佳 URL
 * - CDN 可达时返回 CDN URL（若已配置映射），否则返回本地路径
 * - CDN 不可达时始终返回本地路径
 */
export function getImageUrl(localPath: string): string {
  if (_cdnFailed) return localPath
  return LOCAL_TO_CDN[localPath] ?? localPath
}

/**
 * 查询本地路径对应的 CDN URL
 * 无映射或 CDN 不可达时返回 null
 */
export function getCdnUrl(localPath: string): string | null {
  if (_cdnFailed) return null
  return LOCAL_TO_CDN[localPath] ?? null
}

/** 获取 CDN URL 对应的本地回退路径 */
export function getLocalFallback(cdnUrl: string): string | null {
  return CDN_TO_LOCAL[cdnUrl] ?? null
}

/**
 * 探测 CDN 是否可达（加载一张已知图片）
 * 超时 3 秒后判定为不可达。
 */
export function checkCdnAvailability(): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image()
    const timeout = setTimeout(() => {
      resolve(false)
    }, 3000)
    img.onload = () => {
      clearTimeout(timeout)
      resolve(true)
    }
    img.onerror = () => {
      clearTimeout(timeout)
      resolve(false)
    }
    // 用 l1.png 作为探针（所有 OSS 桶中最小的一张图）
    img.src = `${CDN_BASE}/l1.png`
  })
}
