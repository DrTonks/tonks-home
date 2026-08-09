import { describe, expect, it } from 'vitest'
import { getPetMemoryLabel } from './petMemoryLabels'

describe('getPetMemoryLabel', () => {
  it('maps all recent memory fields to readable Chinese labels', () => {
    expect(getPetMemoryLabel('recent_song')).toBe('最近听的歌')
    expect(getPetMemoryLabel('recent_game')).toBe('最近玩的游戏')
    expect(getPetMemoryLabel('recent_food')).toBe('最近吃到的美食')
    expect(getPetMemoryLabel('recent_book')).toBe('最近读的书')
    expect(getPetMemoryLabel('recent_anime')).toBe('最近看的番剧')
    expect(getPetMemoryLabel('city_life')).toBe('最近的城市生活')
  })

  it('never exposes an unknown raw parameter name', () => {
    expect(getPetMemoryLabel('future_internal_key')).toBe('其他记忆')
  })
})
