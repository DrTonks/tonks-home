import { useMusicStore } from '@/stores/music'
import { useThemeStore } from '@/stores/theme'
import { streamPetReply, type PetAIRequest, type PetAIStage } from '@/api/petAi'
import { usePetMemory } from './usePetMemory'
import { useWeatherVisitor } from './useWeatherVisitor'
import type { PetQuestion, SubmittedPetAnswer } from './usePetQuestions'
import type { SpeechBubbleApi } from '@/components/layout/pet/useSpeechBubble'
import { prependPetReply } from '@/lib/petReplyText'

interface PetReplyDialogue {
  mood_replies?: Record<string, string[]>
  question_replies?: Record<string, string[]>
}

function pick(lines: string[] | undefined): string {
  if (!lines?.length) return ''
  return lines[Math.floor(Math.random() * lines.length)]
}

function renderTemplate(line: string, values: Record<string, string>): string {
  return line
    .replace(/\{\{(\w+)\}\}/g, (match, key: string) => values[key] ?? match)
    .replace(/[?？]+/g, '。')
}

export function usePetQuestionResponder(
  petId: 'static' | 'live2d',
  dialogue: PetReplyDialogue,
  bubble: SpeechBubbleApi,
  getPetCenter?: () => { x: number; y: number },
) {
  const memory = usePetMemory()
  const weatherVisitor = useWeatherVisitor()
  const theme = useThemeStore()
  const music = useMusicStore()

  function fallback(question: PetQuestion, answer: string): string {
    if (question.fallbackKey === 'mood') return pick(dialogue.mood_replies?.[answer])
    const line = pick(dialogue.question_replies?.[question.fallbackKey || ''])
    return renderTemplate(line, {
      answer,
      city: weatherVisitor.getLocationData()?.city || '这里',
      user_name: memory.getValue('user_name') || '',
    })
  }

  function sayFallback(question: PetQuestion, answer: string, replyPrefix = '') {
    const line = fallback(question, answer)
    const reply = line || (petId === 'live2d' ? '好，我记住啦~' : '……我记下了。')
    bubble.say(prependPetReply(replyPrefix, reply), true, true)
  }

  function context(
    question: PetQuestion,
    previousAnswer: string | null,
  ): NonNullable<PetAIRequest['context']> {
    const location = weatherVisitor.getLocationData()
    const weather = weatherVisitor.getWeatherData()
    const includePlace = question.id === 'q_city_life' || question.id === 'q_recent_food'
    return {
      ...(previousAnswer ? { previous_answer: previousAnswer } : {}),
      ...(memory.getValue('user_name') ? { user_name: memory.getValue('user_name')! } : {}),
      ...(includePlace && location?.city ? { city: location.city } : {}),
      ...(question.id === 'q_city_life' && weather
        ? { weather: { desc: weather.desc, temp: weather.temp } }
        : {}),
    }
  }

  async function respond(
    question: PetQuestion,
    submitted: SubmittedPetAnswer,
    replyPrefix = '',
  ): Promise<void> {
    if (question.replyMode === 'fixed') {
      sayFallback(question, submitted.answer, replyPrefix)
      return
    }
    if (question.replyMode === 'action') {
      respondToAction(question, submitted.answer === 'confirm')
      return
    }
    if (question.replyMode !== 'ai_with_fallback') return

    bubble.showStatus('thinking')
    try {
      const reply = await streamPetReply(
        {
          pet_id: petId,
          question_id: question.id,
          answer: submitted.answer,
          context: context(question, submitted.previousAnswer),
        },
        (stage: PetAIStage) => bubble.showStatus(stage),
      )
      bubble.say(prependPetReply(replyPrefix, reply), true, true)
    } catch (error) {
      console.warn('[pet-ai] reply unavailable, using local fallback', error)
      sayFallback(question, submitted.answer, replyPrefix)
    }
  }

  function respondToAction(question: PetQuestion, accepted: boolean): void {
    if (question.action === 'toggle_theme') {
      memory.setActionOutcome(question.id, accepted ? 'accepted' : 'rejected')
      if (accepted) {
        const center = getPetCenter?.()
        theme.toggle(center?.x, center?.y)
      }
      const key = accepted ? 'theme_accept' : 'theme_reject'
      const line = pick(dialogue.question_replies?.[key])
      if (line) bubble.say(line, true, true)
      return
    }
    if (question.action === 'play_music') {
      if (accepted && !music.isEmpty && !music.isPlaying) music.togglePlay()
      const key = accepted ? 'play_music_accept' : 'play_music_reject'
      const line = pick(dialogue.question_replies?.[key])
      if (line) bubble.say(line, true, true)
    }
  }

  /** 顶部关闭主题建议时静默永久关闭；音乐建议只略过当天已触发项。 */
  function dismissAction(question: PetQuestion): void {
    if (question.action === 'toggle_theme') memory.setActionOutcome(question.id, 'rejected')
  }

  return { respond, dismissAction }
}
