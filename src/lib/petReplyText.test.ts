import { describe, expect, it } from 'vitest'
import { prependPetReply } from './petReplyText'

describe('prependPetReply', () => {
  it('places a successful recommendation acknowledgement before the normal reply', () => {
    expect(prependPetReply('谢谢，已经收到推荐。', '这部作品很有意思。')).toBe(
      '谢谢，已经收到推荐。这部作品很有意思。',
    )
    expect(prependPetReply('推荐已经收到~', '今晚可以慢慢看。')).toBe(
      '推荐已经收到~今晚可以慢慢看。',
    )
  })
})
