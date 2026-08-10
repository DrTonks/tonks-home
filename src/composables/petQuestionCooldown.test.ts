import { describe, expect, it } from 'vitest'
import { PET_GLOBAL_QUESTION_COOLDOWN_MINUTES } from './usePetMemory'

describe('pet question global cooldown', () => {
  it('uses a fifteen minute cooldown between question bubbles', () => {
    expect(PET_GLOBAL_QUESTION_COOLDOWN_MINUTES).toBe(15)
  })
})
