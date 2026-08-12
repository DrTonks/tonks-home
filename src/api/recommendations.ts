import { api } from './index'
import { getPetAIClientId } from './petAi'

export type RecommendationCategory = 'music' | 'book' | 'game' | 'anime'

export interface Recommendation {
  id: number
  category: RecommendationCategory
  content: string
  user_name: string
  city: string
  created_at: string
}

export interface RecommendationFilters {
  category?: RecommendationCategory
  date?: string
}

const QUESTION_CATEGORIES: Partial<Record<string, RecommendationCategory>> = {
  q_recent_music: 'music',
  q_recent_book: 'book',
  q_recent_game: 'game',
  q_recent_anime: 'anime',
}

export function recommendationCategoryForQuestion(
  questionId: string | undefined,
): RecommendationCategory | null {
  return questionId ? (QUESTION_CATEGORIES[questionId] ?? null) : null
}

export function recommendationSourceLabel(
  recommendation: Pick<Recommendation, 'user_name' | 'city'>,
): string {
  const visitor = recommendation.user_name === 'unknown' ? '匿名访客' : recommendation.user_name
  const city = recommendation.city === 'unknown' ? '城市未知' : recommendation.city
  return `来自 ${visitor} · ${city}`
}

export async function submitRecommendation(input: {
  category: RecommendationCategory
  content: string
  user_name?: string
  city?: string
}): Promise<Recommendation> {
  const { data } = await api.post('/pet/recommendations', input, {
    headers: { 'X-Client-ID': getPetAIClientId() },
  })
  if (!data?.success || !data.recommendation) {
    const error = new Error(data?.message || data?.code || 'save_failed') as Error & { code?: string }
    error.code = data?.code || 'save_failed'
    throw error
  }
  return data.recommendation as Recommendation
}

export async function getRecommendations(
  filters: RecommendationFilters = {},
): Promise<Recommendation[]> {
  const { data } = await api.get('/pet/recommendations', { params: filters })
  if (!data?.success || !Array.isArray(data.recommendations)) {
    throw new Error(data?.code || 'load_failed')
  }
  return data.recommendations as Recommendation[]
}

export async function deleteRecommendation(id: number): Promise<void> {
  const { data } = await api.delete(`/pet/recommendations/${id}`)
  if (!data?.success) throw new Error(data?.code || 'delete_failed')
}
