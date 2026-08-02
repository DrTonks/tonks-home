export const LIGHT_BACKGROUND_IMAGES = [
  '/assets/lightbg/l1.png',
  '/assets/lightbg/l2.png',
  '/assets/lightbg/l3.png',
  '/assets/lightbg/l4.png',
] as const

export const DARK_BACKGROUND_IMAGES = [
  '/assets/darkbg/d1.png',
  '/assets/darkbg/d2.png',
  '/assets/darkbg/d3.png',
  '/assets/darkbg/d4.png',
] as const

export const BACKGROUND_IMAGE_COUNT = Math.min(
  LIGHT_BACKGROUND_IMAGES.length,
  DARK_BACKGROUND_IMAGES.length,
)

function getPairedBackgroundImages(start: number, darkFirst: boolean) {
  return Array.from({ length: BACKGROUND_IMAGE_COUNT - start }, (_, offset) => {
    const index = start + offset
    const light = LIGHT_BACKGROUND_IMAGES[index]
    const dark = DARK_BACKGROUND_IMAGES[index]
    return darkFirst ? [dark, light] : [light, dark]
  }).flat()
}

export function getInitialBackgroundImages(darkFirst: boolean) {
  return getPairedBackgroundImages(0, darkFirst).slice(0, 4)
}

export function getDeferredBackgroundImages(darkFirst: boolean) {
  return getPairedBackgroundImages(2, darkFirst)
}
