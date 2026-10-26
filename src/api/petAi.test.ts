import { afterEach, describe, expect, it, vi } from 'vitest'
import { PetAIError, parseSSEBlock, streamPetReply } from './petAi'

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


afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers() })
describe('pet reply transport compatibility', () => {
  const payload = { pet_id: 'static' as const, question_id: 'q_mood', answer: '开心' }
  function mockStream(emoji?: unknown) {
    vi.stubGlobal('window', globalThis)
    vi.stubGlobal('localStorage', { getItem: () => 'test-client' })
    const data = `data: ${JSON.stringify({ type: 'result', reply: '好耶。', emoji_id: emoji })}\n\n`
    const bytes = new TextEncoder().encode(data)
    vi.stubGlobal('fetch', vi.fn(async () => new Response(new ReadableStream({ start(c) {
      // Split inside UTF-8 bytes, not just on SSE message boundaries.
      c.enqueue(bytes.slice(0, 43)); c.enqueue(bytes.slice(43)); c.close()
    } }))))
  }
  it('accepts old replies and keeps an optional id from new replies', async () => {
    mockStream()
    expect(await streamPetReply(payload, () => {})).toEqual({ reply: '好耶。' })
    mockStream('quiet_happy')
    expect(await streamPetReply(payload, () => {})).toEqual({ reply: '好耶。', emoji_id: 'quiet_happy' })
  })
  it('drops an asset URL instead of treating it as an image id', async () => {
    mockStream('https://evil.test/image.png')
    expect(await streamPetReply(payload, () => {})).toEqual({ reply: '好耶。' })
  })
  it('propagates cancellation to the pending fetch', async () => {
    vi.stubGlobal('window', globalThis)
    vi.stubGlobal('localStorage', { getItem: () => 'test-client' })
    let received: AbortSignal | undefined
    vi.stubGlobal('fetch', vi.fn((_url, init) => new Promise((_resolve, reject) => {
      received = init.signal
      received!.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
    })))
    const controller = new AbortController()
    const request = streamPetReply(payload, () => {}, 15000, controller.signal)
    const rejected = expect(request).rejects.toBeInstanceOf(PetAIError)
    controller.abort()
    await rejected
    expect(received?.aborted).toBe(true)
  })

  function pendingStream() {
    vi.useFakeTimers()
    vi.stubGlobal('window', globalThis)
    vi.stubGlobal('localStorage', { getItem: () => 'test-client' })
    let controller!: ReadableStreamDefaultController<Uint8Array>
    vi.stubGlobal('fetch', vi.fn(async (_url, init) => new Response(new ReadableStream({ start(c) {
      controller = c
      init.signal.addEventListener('abort', () => c.error(new DOMException('Aborted', 'AbortError')))
    } }))))
    const emit = (event: object) => controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`))
    return { emit, close: () => controller.close() }
  }

  it('renews the idle timeout through three searches and returns the final reply', async () => {
    const stream = pendingStream()
    const stage = vi.fn()
    const result = streamPetReply(payload, stage)
    await vi.advanceTimersByTimeAsync(0)
    for (let i = 0; i < 3; i++) {
      await vi.advanceTimersByTimeAsync(10_000)
      stream.emit({ type: 'status', stage: 'searching' })
      await vi.advanceTimersByTimeAsync(5_000)
      stream.emit({ type: 'status', stage: 'thinking' })
    }
    stream.emit({ type: 'result', reply: '核实好了。' })
    stream.close()
    expect(await result).toEqual({ reply: '核实好了。' })
    expect(stage).toHaveBeenCalledTimes(6)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('times out a silent stream instead of waiting for the total deadline', async () => {
    pendingStream()
    const result = streamPetReply(payload, () => {})
    const rejected = expect(result).rejects.toMatchObject({ code: 'timeout' })
    await vi.advanceTimersByTimeAsync(35_001)
    await rejected
    expect(vi.getTimerCount()).toBe(0)
  })

  it('enforces the total deadline even if valid statuses keep arriving', async () => {
    const stream = pendingStream()
    const result = streamPetReply(payload, () => {})
    const rejected = expect(result).rejects.toMatchObject({ code: 'timeout' })
    await vi.advanceTimersByTimeAsync(0)
    for (let i = 0; i < 8; i++) {
      await vi.advanceTimersByTimeAsync(10_000)
      stream.emit({ type: 'status', stage: 'thinking' })
    }
    await vi.advanceTimersByTimeAsync(10_001)
    await rejected
    expect(vi.getTimerCount()).toBe(0)
  })
})
