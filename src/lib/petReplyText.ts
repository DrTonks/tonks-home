export function prependPetReply(prefix: string, reply: string): string {
  return `${prefix.trim()}${reply.trim()}`
}
