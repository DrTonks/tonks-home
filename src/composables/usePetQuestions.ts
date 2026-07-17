/**
 * 桌宠提问调度器 — 问题选取、回答处理、拒绝管理、冷却协调。
 * 依赖 usePetMemory，静态导入共享提问句库 pet-questions.json。
 */
import { ref } from 'vue'
import { usePetMemory } from './usePetMemory'
import questionsData from '@/data/pet-questions.json'

export interface PetQuestion {
  id: string
  key: string | null
  personas: { static: string; live2d: string }
  inputType: 'text' | 'choice'
  choices: string[] | null
  placeholder: string
  required: boolean
  maxLength?: number
  icon: string
}

const questions = questionsData as PetQuestion[]

export function usePetQuestions() {
  const memory = usePetMemory()
  const currentQuestion = ref<PetQuestion | null>(null)
  const isActive = ref(false)

  /** 随机选取一个可用的未回答、未拒绝、冷却完毕的问题 */
  function pickQuestion(): PetQuestion | null {
    const answeredIds = new Set(memory.getAnsweredQuestionIds())

    const available = questions.filter(q => {
      // 已回答（有 memory key 且已存值）
      if (q.key && memory.hasMemory(q.key)) return false
      if (q.key && answeredIds.has(q.id)) return false
      // 已拒绝
      if (memory.isRejected(q.id)) return false
      return true
    })

    if (!available.length) return null

    const picked = available[Math.floor(Math.random() * available.length)]
    currentQuestion.value = picked
    return picked
  }

  function submitAnswer(question: PetQuestion, answer: string): void {
    if (question.key) {
      memory.setValue(question.key, answer.trim(), question.id)
    }
    memory.markQuestionAsked()
  }

  function rejectCurrent(question: PetQuestion): void {
    memory.rejectQuestion(question.id)
    memory.markQuestionAsked()
  }

  function dismiss(): void {
    isActive.value = false
    currentQuestion.value = null
  }

  function canAskNow(): boolean {
    return memory.canAskQuestion(15) // 15 分钟冷却
  }

  return {
    currentQuestion,
    isActive,
    pickQuestion,
    submitAnswer,
    rejectCurrent,
    dismiss,
    canAskNow,
  }
}
