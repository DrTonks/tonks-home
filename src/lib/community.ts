import type { CommentPage, CommunityComment, FriendApplication } from '@/api/community'

export interface CommunityRoom {
  page: CommunityRoomKey
  name: string
  label: string
  description: string
  avatar: string
}

export type CommunityRoomKey = CommentPage | 'feedback'

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

export interface CommunityMessageGroup {
  key: string
  label: string
  messages: CommunityComment[]
}

export const COMMUNITY_ROOMS: readonly CommunityRoom[] = [
  {
    page: 'about',
    name: 'About',
    label: '关于本站',
    description: '聊聊这个小站，以及藏在页面背后的故事。',
    avatar: '/assets/group/about.jpg',
  },
  {
    page: 'friends',
    name: 'Friends',
    label: '友链',
    description: '认识新朋友，也欢迎分享你在网络上的居所。',
    avatar: '/assets/group/friends.jpg',
  },
  {
    page: 'feedback',
    name: 'Feedback',
    label: '反馈',
    description: '欢迎反馈网站浏览相关的问题！',
    avatar: '/assets/group/feedback.jpg',
  },
]

export function sortCommunityMessages(comments: CommunityComment[]): CommunityComment[] {
  return [...comments].sort((a, b) => {
    const timeDifference = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    return timeDifference || a.id - b.id
  })
}

function localDateKey(value: Date): string {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function communityDateLabel(value: Date, now: Date): string {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const target = new Date(value.getFullYear(), value.getMonth(), value.getDate())
  const dayDifference = Math.round((today.getTime() - target.getTime()) / 86_400_000)
  if (dayDifference === 0) return '今天'
  if (dayDifference === 1) return '昨天'
  if (value.getFullYear() === now.getFullYear()) {
    return `${value.getMonth() + 1}月${value.getDate()}日`
  }
  return `${value.getFullYear()}年${value.getMonth() + 1}月${value.getDate()}日`
}

export function groupCommunityMessagesByLocalDate(
  comments: CommunityComment[],
  now = new Date(),
): CommunityMessageGroup[] {
  const groups = new Map<string, CommunityMessageGroup>()
  for (const comment of sortCommunityMessages(comments)) {
    const createdAt = new Date(comment.created_at)
    const safeDate = Number.isNaN(createdAt.getTime()) ? now : createdAt
    const key = localDateKey(safeDate)
    const existing = groups.get(key)
    if (existing) existing.messages.push(comment)
    else groups.set(key, { key, label: communityDateLabel(safeDate, now), messages: [comment] })
  }
  return [...groups.values()]
}

export function indexCommunityMessages(
  comments: CommunityComment[],
): Map<number, CommunityComment> {
  return new Map(comments.map((comment) => [comment.id, comment]))
}

export function communityAuthorKey(comment: CommunityComment): string {
  if (comment.is_admin) return 'station-owner'
  return comment.author_key || `legacy:${comment.nickname}:${comment.website}`
}

export function buildCommunityMembers(comments: CommunityComment[]): CommunityMember[] {
  const members = new Map<string, CommunityMember>()
  for (const comment of sortCommunityMessages(comments)) {
    const authorKey = communityAuthorKey(comment)
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
