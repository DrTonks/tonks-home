import type { CommentPage, CommunityComment, FriendApplication } from '@/api/community'

export interface CommunityRoom {
  page: CommentPage
  name: string
  label: string
  description: string
}

export interface CommunityMember {
  authorKey: string
  nickname: string
  website: string
  avatarCommentId: number
  messageCount: number
  lastCommentAt: string
  isAdmin: boolean
}

export interface VisitorIdentity {
  nickname: string
  email: string
  website: string
}

export const COMMUNITY_ROOMS: readonly CommunityRoom[] = [
  {
    page: 'about',
    name: 'About',
    label: '关于本站',
    description: '聊聊这个小站，以及藏在页面背后的故事。',
  },
  {
    page: 'friends',
    name: 'Friends',
    label: '友链',
    description: '认识新朋友，也欢迎分享你在网络上的居所。',
  },
]

export function sortCommunityMessages(comments: CommunityComment[]): CommunityComment[] {
  return [...comments].sort((a, b) => {
    const timeDifference = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    return timeDifference || a.id - b.id
  })
}

export function indexCommunityMessages(
  comments: CommunityComment[],
): Map<number, CommunityComment> {
  return new Map(comments.map((comment) => [comment.id, comment]))
}

export function buildCommunityMembers(comments: CommunityComment[]): CommunityMember[] {
  const members = new Map<string, CommunityMember>()
  for (const comment of sortCommunityMessages(comments)) {
    const authorKey = comment.author_key || `legacy:${comment.nickname}:${comment.website}`
    const existing = members.get(authorKey)
    members.set(authorKey, {
      authorKey,
      nickname: comment.nickname,
      website: comment.website,
      avatarCommentId: comment.id,
      messageCount: (existing?.messageCount ?? 0) + 1,
      lastCommentAt: comment.created_at,
      isAdmin: Boolean(existing?.isAdmin || comment.is_admin),
    })
  }
  return [...members.values()].sort((a, b) => {
    if (a.isAdmin !== b.isAdmin) return a.isAdmin ? -1 : 1
    return new Date(b.lastCommentAt).getTime() - new Date(a.lastCommentAt).getTime()
  })
}

export function latestCommunityMessage(comments: CommunityComment[]): CommunityComment | null {
  return sortCommunityMessages(comments).at(-1) ?? null
}

export function friendApplicationJson(application: FriendApplication): string {
  return JSON.stringify(
    {
      name: application.name,
      description: application.description,
      avatar: application.avatar,
      url: application.website,
      category: 'Friend',
      fastener: 'pin',
    },
    null,
    2,
  )
}
