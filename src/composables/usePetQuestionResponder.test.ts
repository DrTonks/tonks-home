import { afterEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'
const mocks = vi.hoisted(() => ({ stream: vi.fn(), sayReply: vi.fn() }))
vi.mock('@/api/petAi', () => ({ streamPetReply: mocks.stream }))
vi.mock('./usePetReactions', () => ({ usePetReactions: () => ({ sayReply: mocks.sayReply }) }))
vi.mock('@/stores/music', () => ({ useMusicStore: () => ({}) }))
vi.mock('@/stores/theme', () => ({ useThemeStore: () => ({}) }))
vi.mock('@/stores/petEnv', () => ({ usePetEnvStore: () => ({ isQuestionActive: false }) }))
vi.mock('./usePetMemory', () => ({ usePetMemory: () => ({ getValue: () => null }) }))
vi.mock('./useWeatherVisitor', () => ({ useWeatherVisitor: () => ({ getWeatherData: () => null, getLocationData: () => null }) }))
import { usePetQuestionResponder } from './usePetQuestionResponder'
import { useSpeechBubble } from '@/components/layout/pet/useSpeechBubble'
import type { PetQuestion } from './usePetQuestions'
const question = { id: 'q_mood', replyMode: 'ai_with_fallback' } as PetQuestion
const answer = { answer: '开心', previousAnswer: null }
afterEach(() => { vi.clearAllMocks() })

function start() {
  let resolve!: (value: { reply: string; emoji_id?: string }) => void
  mocks.stream.mockReturnValue(new Promise(r => { resolve = r }))
  const scope = effectScope()
  const bubble = useSpeechBubble()
  const responder = scope.run(() => usePetQuestionResponder('static', {}, bubble))!
  return { scope, bubble, responder, resolve: (value: { reply: string; emoji_id?: string }) => resolve(value) }
}
describe('pet AI lifecycle', () => {
  it('presents text and optional image together and preserves acknowledgement', async () => {
    const t = start()
    const pending = t.responder.respond(question, answer, '谢谢推荐。')
    t.resolve({ reply: '好耶。', emoji_id: 'quiet_happy' })
    await pending
    expect(mocks.sayReply).toHaveBeenCalledWith('好耶。', 'quiet_happy', '谢谢推荐。')
    t.scope.stop(); t.bubble.hide()
  })
  it('aborts on character unmount and ignores its late response', async () => {
    const t = start()
    const pending = t.responder.respond(question, answer)
    const signal = mocks.stream.mock.calls[0]![3] as AbortSignal
    t.scope.stop()
    expect(signal.aborted).toBe(true)
    t.resolve({ reply: '迟到的回复。' })
    await pending
    expect(mocks.sayReply).not.toHaveBeenCalled()
    t.bubble.hide()
  })
  it('does not replace newer lyrics with a late AI result', async () => {
    const t = start()
    const pending = t.responder.respond(question, answer)
    t.bubble.showLyric('正在播放的歌')
    t.resolve({ reply: '迟到的回复。' })
    await pending
    expect(mocks.sayReply).not.toHaveBeenCalled()
    expect(t.bubble.mode.value).toBe('lyric')
    t.scope.stop(); t.bubble.hide()
  })
})
