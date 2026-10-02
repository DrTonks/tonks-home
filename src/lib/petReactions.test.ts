import { describe, expect, it } from 'vitest'
import { createReactionPicker, findReaction, legacyReaction, petReactions } from './petReactions'

describe('pet reaction policy', () => {
  it('keeps persona-exclusive images separate and recognizes the old image pool', () => {
    expect(findReaction('live2d', 'quiet_happy')).toBeUndefined()
    expect(findReaction('static', 'u_cheer')).toBeUndefined()
    expect(legacyReaction('static', '/assets/emoji/happy-1.jpg')?.id).toBe('quiet_happy')
    expect(legacyReaction('live2d', '/assets/emoji/happy-1.jpg')).toBeUndefined()
    expect(findReaction('static', 'https://example.com/a.png')).toBeUndefined()
  })
  it('shares cooldown across characters and avoids recent repeats', () => {
    let time = 0
    const picker = createReactionPicker(() => time, () => 0)
    const first = picker.local('static', 'happy')!
    expect(first).toBeDefined()
    picker.mark(first)
    expect(picker.local('live2d', 'happy')).toBeUndefined()
    expect(picker.reply('static', first.id)).toBeUndefined()
    time += 45000
    expect(picker.reply('static', first.id)).toBeUndefined()
    expect(picker.local('live2d', 'happy')?.pets).toContain('live2d')
  })
  it('uses different local probabilities while never substituting unrelated scenes', () => {
    expect(createReactionPicker(Date.now, () => .3).local('static', 'happy')).toBeUndefined()
    expect(createReactionPicker(Date.now, () => .3).local('live2d', 'happy')).toBeDefined()
    expect(createReactionPicker(Date.now, () => 0).local('live2d', 'threat')).toBeUndefined()
    expect(petReactions.every(r => r.src.startsWith('/emojis/') && r.label)).toBe(true)
  })
})
