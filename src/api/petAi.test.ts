import { describe, expect, it } from 'vitest'
import { PetAIError, parseSSEBlock } from './petAi'

describe('pet AI SSE parser', () => {
  it('parses only the public stage enum payload', () => {
    expect(parseSSEBlock('data: {"type":"status","stage":"searching"}')).toEqual({
      type: 'status',
      stage: 'searching',
    })
  })

  it('supports multi-line SSE data and ignores comments', () => {
    const event = parseSSEBlock(': keepalive\ndata: {"type":"result",\ndata: "reply":"记住了。"}')
    expect(event).toEqual({ type: 'result', reply: '记住了。' })
  })

  it('rejects malformed event data without exposing it', () => {
    expect(() => parseSSEBlock('data: definitely-not-json')).toThrow(PetAIError)
    expect(parseSSEBlock(': keepalive')).toBeNull()
  })
})
