export type PetAIStage = 'thinking' | 'searching'

export interface PetAIRequest {
  pet_id: 'static' | 'live2d'
  question_id: string
  answer: string
  context?: {
    previous_answer?: string
    user_name?: string
    city?: string
    weather?: { desc?: string; temp?: number }
  }
}

interface PetAIEvent {
  type: 'status' | 'result' | 'error'
  stage?: PetAIStage
  reply?: string
  code?: string
}

export class PetAIError extends Error {
  constructor(public readonly code: string) {
    super(code)
    this.name = 'PetAIError'
  }
}

const CLIENT_ID_KEY = 'pet_ai_client_id'

export function getPetAIClientId(): string {
  try {
    const existing = localStorage.getItem(CLIENT_ID_KEY)
    if (existing) return existing
    const generated = crypto.randomUUID()
    localStorage.setItem(CLIENT_ID_KEY, generated)
    return generated
  } catch {
    return crypto.randomUUID()
  }
}

export function parseSSEBlock(block: string): PetAIEvent | null {
  const dataLines = block
    .split(/\r?\n/)
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trimStart())
  if (!dataLines.length) return null
  try {
    return JSON.parse(dataLines.join('\n')) as PetAIEvent
  } catch {
    throw new PetAIError('invalid_stream')
  }
}

export async function streamPetReply(
  payload: PetAIRequest,
  onStage: (stage: PetAIStage) => void,
  timeoutMs = 15_000,
): Promise<string> {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch('/api/pet/reply', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        'X-Client-ID': getPetAIClientId(),
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { code?: string } | null
      throw new PetAIError(body?.code || `http_${response.status}`)
    }
    if (!response.body) throw new PetAIError('empty_stream')

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let reply = ''

    const handleBlock = (block: string) => {
      const event = parseSSEBlock(block)
      if (!event) return
      if (event.type === 'status' && (event.stage === 'thinking' || event.stage === 'searching')) {
        onStage(event.stage)
      } else if (event.type === 'result' && event.reply) {
        reply = event.reply
      } else if (event.type === 'error') {
        throw new PetAIError(event.code || 'reply_failed')
      }
    }

    while (true) {
      const { done, value } = await reader.read()
      buffer += decoder.decode(value, { stream: !done })
      let boundary = buffer.match(/\r?\n\r?\n/)
      while (boundary?.index != null) {
        handleBlock(buffer.slice(0, boundary.index))
        buffer = buffer.slice(boundary.index + boundary[0].length)
        boundary = buffer.match(/\r?\n\r?\n/)
      }
      if (done) break
    }
    if (buffer.trim()) handleBlock(buffer)
    if (!reply) throw new PetAIError('empty_reply')
    return reply
  } catch (error) {
    if (error instanceof PetAIError) throw error
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new PetAIError('timeout')
    }
    throw new PetAIError('network_error')
  } finally {
    window.clearTimeout(timer)
  }
}
