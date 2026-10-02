import type { SpeechBubbleApi } from '@/components/layout/pet/useSpeechBubble'
import { legacyReaction, reactionPicker, type PetPersona, type ReactionScene } from '@/lib/petReactions'

export function usePetReactions(pet: PetPersona, bubble: SpeechBubbleApi) {
  function sayLocal(scene: ReactionScene, line: string, force = false) {
    if (!line) return
    const legacy = legacyReaction(pet, line)
    const image = reactionPicker.local(pet, scene, legacy)
    const fallback = legacy?.fallback || legacy?.label || line
    bubble.sayReply({
      text: image?.imageOnly ? '' : fallback,
      image,
      onImageShown: image ? () => reactionPicker.mark(image) : undefined,
    }, force)
  }
  function sayReply(text: string, emojiId?: string, prefix = '') {
    const legacy = legacyReaction(pet, text)
    const image = reactionPicker.reply(pet, emojiId || legacy?.id)
    // Preserve acknowledgement prefixes, even when a legacy fixed reply is an image.
    bubble.sayReply({
      text: `${prefix.trim()}${legacy?.fallback || legacy?.label || text.trim()}`,
      image,
      onImageShown: image ? () => reactionPicker.mark(image) : undefined,
    }, true, true)
  }
  return { sayLocal, sayReply }
}
