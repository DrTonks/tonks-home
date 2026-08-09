import { beforeEach, describe, expect, it, vi } from 'vitest'

const { submitRecommendation } = vi.hoisted(() => ({ submitRecommendation: vi.fn() }))

vi.mock('@/api/recommendations', () => ({
  recommendationCategoryForQuestion: (id: string) => (id === 'q_recent_anime' ? 'anime' : null),
  submitRecommendation,
}))

import { usePetRecommendation } from './usePetRecommendation'

describe('usePetRecommendation', () => {
  beforeEach(() => {
    submitRecommendation.mockReset()
    submitRecommendation.mockResolvedValue({})
  })

  it('submits only the cached city name and continues after a successful save', async () => {
    const continued = vi.fn()
    const recommendation = usePetRecommendation(
      () => 'q_recent_anime',
      () => 'Tonks',
      () => '福州',
      continued,
    )

    await recommendation.recommend('缎带英雄')

    expect(submitRecommendation).toHaveBeenCalledWith({
      category: 'anime',
      content: '缎带英雄',
      user_name: 'Tonks',
      city: '福州',
    })
    expect(continued).toHaveBeenCalledWith('缎带英雄', true)
  })

  it('omits city when no cached city is available', async () => {
    const recommendation = usePetRecommendation(
      () => 'q_recent_anime',
      () => null,
      () => null,
      vi.fn(),
    )

    await recommendation.recommend('缎带英雄')

    expect(submitRecommendation).toHaveBeenCalledWith({
      category: 'anime',
      content: '缎带英雄',
    })
  })
})
