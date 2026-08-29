import type { CommunityComment, FriendApplication } from '@/api/community'

export interface CommentThread {
  root: CommunityComment
  replies: CommunityComment[]
}

export function buildCommentThreads(comments: CommunityComment[]): CommentThread[] {
  const roots = comments.filter((comment) => comment.parent_id === null)
  const rootIds = new Set(roots.map((comment) => comment.id))
  const orphans = comments.filter(
    (comment) => comment.parent_id !== null && !rootIds.has(comment.root_id),
  )

  return [...roots, ...orphans]
    .map((root) => ({
      root,
      replies:
        root.parent_id === null
          ? comments
              .filter((comment) => comment.parent_id !== null && comment.root_id === root.id)
              .sort((a, b) => a.id - b.id)
          : [],
    }))
    .sort((a, b) => b.root.id - a.root.id)
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
