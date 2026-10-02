import config from '@/data/pet-reactions.json'
import assets from '@/data/pet-reaction-assets.json'

export type PetPersona = 'static' | 'live2d'
export type ReactionScene = 'greeting' | 'happy' | 'angry' | 'cry' | 'sleep' | 'threat' | 'idle' | 'turn' | 'reply'
export interface PetReaction {
  id: string
  src: string
  label: string
  fallback?: string
  legacySrc?: string
  scenes: string[]
  pets: string[]
}
const assetMap: Record<string, { src: string; label: string }> = assets
export const petReactions: PetReaction[] = config.items.map(item => ({ ...item, ...assetMap[item.id]! }))
export function findReaction(pet: PetPersona, id: unknown): PetReaction | undefined {
  return typeof id === 'string' ? petReactions.find(item => item.id === id && item.pets.includes(pet)) : undefined
}
export function legacyReaction(pet: PetPersona, src: string) {
  return petReactions.find(item => item.pets.includes(pet) && (item.legacySrc === src || item.src === src))
}

// One session-wide history for both pets: switching characters does not reset cooldown.
export function createReactionPicker(now = Date.now, random = Math.random) {
  let lastShown = -Infinity
  let recent: string[] = []
  function allowed(item: PetReaction) {
    return now() - lastShown >= config.cooldownMs && !recent.includes(item.id)
  }
  return {
    local(pet: PetPersona, scene: ReactionScene, preferred?: PetReaction) {
      if (preferred) return allowed(preferred) ? preferred : undefined
      if (now() - lastShown < config.cooldownMs || random() >= config.profiles[pet].chance) return undefined
      const choices = petReactions.filter(item => item.pets.includes(pet) && item.scenes.includes(scene) && allowed(item))
      return choices[Math.floor(random() * choices.length)]
    },
    reply(pet: PetPersona, id: unknown) {
      const item = findReaction(pet, id)
      return item && allowed(item) ? item : undefined
    },
    mark(item: PetReaction) {
      lastShown = now()
      recent = [item.id, ...recent.filter(id => id !== item.id)].slice(0, config.recentCount)
    },
  }
}
export const reactionPicker = createReactionPicker()
export const reactionProfiles = config.profiles
