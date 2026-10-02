import type { SpeechBubbleApi } from '@/components/layout/pet/useSpeechBubble'
import { legacyReaction, reactionPicker, reactionProfiles, type PetPersona, type ReactionScene } from '@/lib/petReactions'

export function usePetReactions(pet: PetPersona, bubble: SpeechBubbleApi) {
  function sayLocal(scene: ReactionScene, line: string, force = false) {
    if (!line) return
    const legacy = legacyReaction(pet, line)
    const image = reactionPicker.local(pet, scene, legacy)
    const fallback = legacy?.fallback || legacy?.label || line
    const accepted = bubble.sayReply({
      text: image && (legacy || reactionProfiles[pet].imageOnly) ? '' : fallback,
      image,
    }, force)
    if (accepted && image) reactionPicker.mark(image)
  }
  function sayReply(text: string, emojiId?: string, prefix = '') {
    const legacy = legacyReaction(pet, text)
    const image = reactionPicker.reply(pet, emojiId || legacy?.id)
    // Preserve acknowledgement prefixes, even when a legacy fixed reply is an image.
    const accepted = bubble.sayReply({ text: `${prefix.trim()}${legacy?.fallback || legacy?.label || text.trim()}`, image }, true, true)
    if (accepted && image) reactionPicker.mark(image)
  }
  return { sayLocal, sayReply }
}
