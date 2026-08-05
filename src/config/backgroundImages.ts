import { getImageUrl } from './cdn'

/** 本地路径常量（始终作为回退引用和计数依据） */
export const LIGHT_BG_PATHS = [
  '/assets/lightbg/l1.png',
  '/assets/lightbg/l2.png',
  '/assets/lightbg/l3.png',
  '/assets/lightbg/l4.png',
] as const

export const DARK_BG_PATHS = [
  '/assets/darkbg/d1.png',
  '/assets/darkbg/d2.png',
  '/assets/darkbg/d3.png',
  '/assets/darkbg/d4.png',
] as const

/** @deprecated 使用 getLightBackgroundUrl(index) 代替 */
export const LIGHT_BACKGROUND_IMAGES = LIGHT_BG_PATHS
/** @deprecated 使用 getDarkBackgroundUrl(index) 代替 */
export const DARK_BACKGROUND_IMAGES = DARK_BG_PATHS

export const BACKGROUND_IMAGE_COUNT = Math.min(
  LIGHT_BG_PATHS.length,
  DARK_BG_PATHS.length,
)

/** 获取亮色背景图的实际 URL（CDN 优先，不可达时回退本地） */
export function getLightBackgroundUrl(index: number): string {
  return getImageUrl(LIGHT_BG_PATHS[index])
}

/** 获取暗色背景图的实际 URL（CDN 优先，不可达时回退本地） */
export function getDarkBackgroundUrl(index: number): string {
  return getImageUrl(DARK_BG_PATHS[index])
}

function getPairedBackgroundImages(start: number, darkFirst: boolean): string[] {
  return Array.from({ length: BACKGROUND_IMAGE_COUNT - start }, (_, offset) => {
    const index = start + offset
    const light = LIGHT_BG_PATHS[index]
    const dark = DARK_BG_PATHS[index]
    return darkFirst ? [dark, light] : [light, dark]
  }).flat()
}

/**
 * 获取首屏需要预加载的背景图路径（始终返回本地路径，由调用方通过 getImageUrl 转换）
 * LoadingScreen 使用它构建预加载列表。
 */
export function getInitialBackgroundPaths(darkFirst: boolean): string[] {
  return getPairedBackgroundImages(0, darkFirst).slice(0, 4)
}

/**
 * 获取延迟预加载的背景图路径（始终返回本地路径，由调用方通过 getImageUrl 转换）
 */
export function getDeferredBackgroundPaths(darkFirst: boolean): string[] {
  return getPairedBackgroundImages(2, darkFirst)
}

/** @deprecated 使用 getInitialBackgroundPaths 代替 */
export const getInitialBackgroundImages = getInitialBackgroundPaths
/** @deprecated 使用 getDeferredBackgroundPaths 代替 */
export const getDeferredBackgroundImages = getDeferredBackgroundPaths
