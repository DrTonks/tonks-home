import { describe, expect, it } from 'vitest'
import { createReactionPicker, findReaction, legacyReaction, petReactions } from './petReactions'

describe('pet reaction policy', () => {
  it('keeps persona-exclusive images separate and recognizes the old image pool', () => {
    expect(findReaction('live2d', 'quiet_happy')).toBeUndefined()
    expect(findReaction('static', 'u_cheer')).toBeUndefined()
    expect(findReaction('static', 'u_drink')?.pets).toContain('static')
    expect(findReaction('live2d', 'u_tv_think')?.src).toContain('/bilibili/')
    expect(findReaction('static', 'u_tv_think')).toBeUndefined()
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
  it('never substitutes unrelated scenes', () => {
    expect(createReactionPicker(Date.now, () => 0).local('live2d', 'threat')).toBeUndefined()
    expect(petReactions.every(r => r.src.startsWith('/emojis/') && r.label)).toBe(true)
  })
  it('partitions pure-picture and sequential replies without multiplying probabilities', () => {
    expect(createReactionPicker(Date.now, () => .399).local('static', 'happy')?.imageOnly).toBe(true)
    expect(createReactionPicker(Date.now, () => .4).local('static', 'happy')?.imageOnly).toBe(false)
    expect(createReactionPicker(Date.now, () => .599).local('static', 'happy')?.imageOnly).toBe(false)
    expect(createReactionPicker(Date.now, () => .6).local('static', 'happy')).toBeUndefined()
    expect(createReactionPicker(Date.now, () => .299).local('live2d', 'happy')?.imageOnly).toBe(true)
    expect(createReactionPicker(Date.now, () => .3).local('live2d', 'happy')?.imageOnly).toBe(false)
    expect(createReactionPicker(Date.now, () => .599).local('live2d', 'happy')?.imageOnly).toBe(false)
    expect(createReactionPicker(Date.now, () => .6).local('live2d', 'happy')).toBeUndefined()
    const legacy = legacyReaction('static', '/assets/emoji/happy-1.jpg')!
    expect(createReactionPicker(Date.now, () => .99).local('static', 'happy', legacy)?.imageOnly).toBe(true)
  })
})
