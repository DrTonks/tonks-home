import { describe, expect, it } from 'vitest'
import { recommendationCategoryForQuestion, recommendationSourceLabel } from './recommendations'

describe('recommendationCategoryForQuestion', () => {
  it('enables only song, book, game, and anime questions', () => {
    expect(recommendationCategoryForQuestion('q_recent_music')).toBe('music')
    expect(recommendationCategoryForQuestion('q_recent_book')).toBe('book')
    expect(recommendationCategoryForQuestion('q_recent_game')).toBe('game')
    expect(recommendationCategoryForQuestion('q_recent_anime')).toBe('anime')
    expect(recommendationCategoryForQuestion('q_recent_food')).toBeNull()
    expect(recommendationCategoryForQuestion(undefined)).toBeNull()
  })
})

describe('recommendationSourceLabel', () => {
  it('formats visitor name and city without exposing internal unknown values', () => {
    expect(recommendationSourceLabel({ user_name: 'Tonks', city: '福州' })).toBe(
      '来自 Tonks · 福州',
    )
    expect(recommendationSourceLabel({ user_name: 'unknown', city: 'unknown' })).toBe(
      '来自 匿名访客 · 城市未知',
    )
  })
})
