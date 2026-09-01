import { describe, expect, it } from 'vitest'
import type { CommunityComment, FriendApplication } from '@/api/community'
import {
  buildCommunityMembers,
  friendApplicationJson,
  groupCommunityMessagesByLocalDate,
  indexCommunityMessages,
  latestCommunityMessage,
  sortCommunityMessages,
} from './community'

function comment(id: number, parentId: number | null, rootId: number): CommunityComment {
  return {
    id,
    page: 'about',
    parent_id: parentId,
    root_id: rootId,
    nickname: `visitor-${id}`,
    website: '',
    content: `comment-${id}`,
    status: 'published',
    is_admin: false,
    owned: false,
    author_key: `author-${id}`,
    created_at: '2026-08-29T00:00:00+00:00',
    reply_to_name: '',
  }
}

describe('community chat helpers', () => {
  it('sorts messages chronologically and indexes reply targets', () => {
    const late = { ...comment(2, 1, 1), created_at: '2026-08-29T02:00:00+00:00' }
    const early = { ...comment(1, null, 1), created_at: '2026-08-29T01:00:00+00:00' }
    const messages = sortCommunityMessages([late, early])
    expect(messages.map((message) => message.id)).toEqual([1, 2])
    expect(indexCommunityMessages(messages).get(1)?.content).toBe('comment-1')
    expect(latestCommunityMessage(messages)?.id).toBe(2)
  })

  it('groups members by stable author key and keeps the latest profile', () => {
    const first = { ...comment(1, null, 1), author_key: 'same-author' }
    const second = {
      ...comment(2, null, 2),
      author_key: 'same-author',
      nickname: 'new-name',
      is_admin: true,
    }
    const visitor = { ...comment(3, null, 3), author_key: 'visitor' }
    const members = buildCommunityMembers([first, visitor, second])
    expect(members).toHaveLength(2)
    expect(members[0]).toMatchObject({
      authorKey: 'same-author',
      nickname: 'new-name',
      messageCount: 2,
      isAdmin: true,
      avatarCommentId: 2,
    })
  })

  it('groups messages by local calendar date instead of labeling everything today', () => {
    const now = new Date(2026, 7, 31, 12)
    const old = { ...comment(1, null, 1), created_at: new Date(2026, 7, 28, 19, 16).toISOString() }
    const yesterday = {
      ...comment(2, null, 2),
      created_at: new Date(2026, 7, 30, 8).toISOString(),
    }
    const today = { ...comment(3, null, 3), created_at: new Date(2026, 7, 31, 9).toISOString() }
    expect(
      groupCommunityMessagesByLocalDate([today, old, yesterday], now).map((group) => group.label),
    ).toEqual(['8月28日', '昨天', '今天'])
  })
})

describe('friendApplicationJson', () => {
  it('matches the static friend wall fields', () => {
    const application: FriendApplication = {
      id: 1,
      name: 'Example',
      description: 'A personal site',
      avatar: 'https://example.com/avatar.png',
      website: 'https://example.com/',
      email: 'owner@example.com',
      status: 'approved',
      moderation_note: '',
      created_at: '',
      updated_at: '',
    }
    expect(JSON.parse(friendApplicationJson(application))).toMatchObject({
      name: 'Example',
      url: 'https://example.com/',
      category: 'Friend',
      fastener: 'pin',
    })
  })
})
