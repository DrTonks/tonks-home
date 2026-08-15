import { describe, expect, it } from 'vitest'
import { getApplicationCategory } from './applicationCategory'

describe('getApplicationCategory', () => {
  it.each([
    ['VSCode 编辑器', '', 'CODE'],
    ['Terminal', '', 'SHELL'],
    ['Edge浏览器', '', 'BROWSE'],
    ['Excel表格', '', 'OFFICE'],
    ['Obsidian', '', 'NOTE'],
    ['记事本', '', 'NOTE'],
    ['QQ音乐', '', 'MEDIA'],
    ['QQ', '', 'CHAT'],
    ['Steam', '', 'GAME'],
    ['ChatGPT', '', 'AI'],
    ['FileZilla', '', 'TRANSFER'],
    ['Clash', '', 'NETWORK'],
    ['文件资源管理器', '', 'SYSTEM'],
    ['未登记应用', '', 'APP'],
    ['锁屏', 'sleeping', 'SLEEP'],
    ['关机中', 'sleeping', 'OFFLINE'],
  ])('maps %s to %s', (appName, color, expected) => {
    expect(getApplicationCategory(appName, color)).toBe(expected)
  })

  it('normalizes surrounding whitespace and case', () => {
    expect(getApplicationCategory('  GITHUB DESKTOP  ')).toBe('CODE')
  })
})
