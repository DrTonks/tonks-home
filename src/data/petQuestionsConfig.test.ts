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
    expect(byId.q_mood.schedule).toEqual({ mode: 'daily', limit: 2 })
    for (const id of [
      'q_recent_music',
      'q_recent_game',
      'q_recent_food',
      'q_recent_book',
      'q_recent_anime',
    ]) {
      expect(byId[id].schedule).toEqual({ mode: 'daily', limit: 1 })
    }
    expect(byId.q_city_life.schedule).toEqual({ mode: 'weekly', limit: 1 })
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
  })
})
