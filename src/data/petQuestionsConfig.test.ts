import { describe, expect, it } from 'vitest'
import questions from './pet-questions.json'

describe('pet question configuration', () => {
  it('keeps every repeatable answer in a one-value local memory slot', () => {
    const recurringAI = questions.filter(
      (question) => question.kind === 'recurring' && question.replyMode === 'ai_with_fallback',
    )
    expect(recurringAI).toHaveLength(7)
    expect(recurringAI.every((question) => Boolean(question.key))).toBe(true)
    expect(new Set(recurringAI.map((question) => question.key)).size).toBe(recurringAI.length)
  })

  it('uses natural-period limits requested by the product rules', () => {
    const byId = Object.fromEntries(questions.map((question) => [question.id, question]))
    // 心情：每 2 天最多 2 次
    expect(byId.q_mood.schedule).toEqual({ mode: 'interval', intervalDays: 2, limit: 2 })
    // 听歌 / 游戏 / 美食：每 2 天 1 次
    for (const id of ['q_recent_music', 'q_recent_game', 'q_recent_food']) {
      expect(byId[id].schedule).toEqual({ mode: 'interval', intervalDays: 2, limit: 1 })
    }
    // 读书 / 番剧：每 3 天 1 次
    for (const id of ['q_recent_book', 'q_recent_anime']) {
      expect(byId[id].schedule).toEqual({ mode: 'interval', intervalDays: 3, limit: 1 })
    }
    // 城市生活：每 7 天 1 次
    expect(byId.q_city_life.schedule).toEqual({ mode: 'interval', intervalDays: 7, limit: 1 })
  })

  it('counts recurring rejections only for the current natural period', () => {
    const recurring = questions.filter((question) => question.kind === 'recurring')
    const oneTimeMemories = questions.filter((question) => question.kind === 'memory')
    expect(recurring.every((question) => question.allowPermanentReject === false)).toBe(true)
    expect(oneTimeMemories.every((question) => question.allowPermanentReject === true)).toBe(true)
  })

  it('keeps theme and music suggestions as local actions', () => {
    const actions = questions.filter((question) => question.kind === 'action')
    expect(actions.map((question) => question.id)).toEqual(['q_theme_suggestion', 'q_play_music'])
    expect(actions.every((question) => question.replyMode === 'action')).toBe(true)
    const theme = actions.find((q) => q.id === 'q_theme_suggestion')!
    expect(theme.schedule).toEqual({ mode: 'interval', intervalDays: 3, limit: 1 })
    expect(theme.allowPermanentReject).toBe(true)
  })
})
