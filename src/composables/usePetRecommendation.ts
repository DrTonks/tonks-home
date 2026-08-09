import { computed, ref, watch } from 'vue'
import { recommendationCategoryForQuestion, submitRecommendation } from '@/api/recommendations'

export function usePetRecommendation(
  getQuestionId: () => string | undefined,
  getUserName: () => string | null,
  getCity: () => string | null,
  continueWithAnswer: (answer: string, recommended: boolean) => void,
) {
  const state = ref<'idle' | 'sending' | 'error'>('idle')
  const category = computed(() => recommendationCategoryForQuestion(getQuestionId()))

  async function recommend(answer: string): Promise<void> {
    if (!category.value || state.value === 'sending') return
    state.value = 'sending'
    try {
      const userName = getUserName()?.trim()
      const city = getCity()?.trim()
      await submitRecommendation({
        category: category.value,
        content: answer,
        ...(userName ? { user_name: userName } : {}),
        ...(city ? { city } : {}),
      })
      state.value = 'idle'
      continueWithAnswer(answer, true)
    } catch (error) {
      console.warn('[recommendations] submit failed', error)
      state.value = 'error'
    }
  }

  watch(getQuestionId, () => {
    state.value = 'idle'
  })

  return { category, state, recommend }
}
