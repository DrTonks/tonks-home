import { describe, expect, it } from 'vitest'
import type { CommunityComment, FriendApplication } from '@/api/community'
import { buildCommentThreads, friendApplicationJson } from './community'

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
    created_at: '2026-08-29T00:00:00+00:00',
    reply_to_name: '',
  }
}

describe('buildCommentThreads', () => {
  it('sorts roots newest first and replies oldest first', () => {
    const threads = buildCommentThreads([
      comment(1, null, 1),
      comment(3, 1, 1),
      comment(2, 1, 1),
      comment(4, null, 4),
    ])
    expect(threads.map((thread) => thread.root.id)).toEqual([4, 1])
    expect(threads[1]?.replies.map((reply) => reply.id)).toEqual([2, 3])
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
