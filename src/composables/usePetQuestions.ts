/**
 * 桌宠提问调度器：候选过滤、自然日/周频控、问题上下文插值和回答持久化。
 */
import { ref } from 'vue'
import { PET_GLOBAL_QUESTION_COOLDOWN_MINUTES, usePetMemory } from './usePetMemory'
import { useWeatherVisitor } from './useWeatherVisitor'
import { useThemeStore } from '@/stores/theme'
import { useMusicStore } from '@/stores/music'
import type { QuestionSchedule } from '@/lib/petQuestionSchedule'
import questionsData from '@/data/pet-questions.json'

export type PetQuestionKind = 'memory' | 'recurring' | 'action'
export type PetReplyMode = 'fixed' | 'ai_with_fallback' | 'action' | 'none'
export type PetQuestionAction = 'toggle_theme' | 'play_music'
export type PetQuestionCondition = 'has_city' | 'theme_unmodified' | 'music_available'

export interface PetQuestion {
  id: string
  key: string | null
  kind: PetQuestionKind
  replyMode: PetReplyMode
  fallbackKey?: string
  action?: PetQuestionAction
  condition?: PetQuestionCondition
  schedule: QuestionSchedule
  allowPermanentReject: boolean
  personas: { static: string; live2d: string }
  inputType: 'text' | 'choice' | 'confirm'
  choices: string[] | null
  placeholder: string
  required: boolean
  maxLength?: number
  icon: string
}

export interface SubmittedPetAnswer {
  answer: string
  previousAnswer: string | null
}

const questions = questionsData as PetQuestion[]

function replaceTokens(text: string, values: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (match, key: string) => values[key] ?? match)
}

export function usePetQuestions() {
  const memory = usePetMemory()
  const weatherVisitor = useWeatherVisitor()
  const theme = useThemeStore()
  const music = useMusicStore()
  const currentQuestion = ref<PetQuestion | null>(null)
  const isActive = ref(false)

  function conditionMet(question: PetQuestion): boolean {
    if (question.condition === 'has_city') {
      return !!weatherVisitor.getLocationData()?.city
    }
    if (question.condition === 'theme_unmodified') {
      try {
        return localStorage.getItem('theme') === null && !memory.getActionOutcome(question.id)
      } catch {
        return false
      }
    }
    if (question.condition === 'music_available') {
      return !music.isEmpty && !music.isPlaying
    }
    return true
  }

  function hydrate(question: PetQuestion): PetQuestion {
    const values = {
      city: weatherVisitor.getLocationData()?.city || '',
      theme_brightness: theme.isDark ? '暗' : '亮',
    }
    return {
      ...question,
      personas: {
        static: replaceTokens(question.personas.static, values),
        live2d: replaceTokens(question.personas.live2d, values),
      },
    }
  }

  /** 随机选取一个符合一次性记忆、自然日/周频控及运行条件的问题。 */
  function pickQuestion(): PetQuestion | null {
    const available = questions.filter((question) => {
      if (question.key && question.kind === 'memory' && memory.hasMemory(question.key)) return false
      if (memory.isRejected(question.id)) return false
      if (!conditionMet(question)) return false
      if (
        question.schedule.mode !== 'once' &&
        !memory.canShowQuestion(question.id, question.schedule)
      )
        return false
      return true
    })

    if (!available.length) return null
    const source = available[Math.floor(Math.random() * available.length)]
    const picked = hydrate(source)
    currentQuestion.value = picked
    if (picked.schedule.mode === 'once') memory.markQuestionAsked()
    else memory.markQuestionShown(picked.id, picked.schedule)
    return picked
  }

  /** 先捕获旧值，再仅用本次值覆盖本地缓存。 */
  function submitAnswer(question: PetQuestion, rawAnswer: string): SubmittedPetAnswer {
    const answer = rawAnswer.trim()
    const previousAnswer = question.key ? memory.getValue(question.key) : null
    if (question.key) memory.setValue(question.key, answer, question.id)
    memory.markQuestionAnswered(question.id)
    return { answer, previousAnswer }
  }

  function rejectCurrent(question: PetQuestion): void {
    if (question.allowPermanentReject) memory.rejectQuestion(question.id)
  }

  function dismiss(): void {
    isActive.value = false
    currentQuestion.value = null
  }

  function canAskNow(): boolean {
    return memory.canAskQuestion(PET_GLOBAL_QUESTION_COOLDOWN_MINUTES)
  }

  return {
    currentQuestion,
    isActive,
    pickQuestion,
    submitAnswer,
    rejectCurrent,
    dismiss,
    canAskNow,
    hydrateQuestion: hydrate,
  }
}
