import axios from 'axios'

export type CommentPage = 'about' | 'friends'
export type CommentStatus = 'published' | 'pending' | 'rejected'
export type FriendApplicationStatus = 'pending' | 'approved' | 'rejected'

export interface CommunityComment {
  id: number
  page: CommentPage
  parent_id: number | null
  root_id: number
  nickname: string
  email?: string
  website: string
  content: string
  status: CommentStatus
  is_admin: boolean
  author_key: string
  created_at: string
  reply_to_name: string
  moderation_reason?: string
}

export interface CommunityCommentSubmission {
  nickname: string
  email: string
  website?: string
  content: string
  parent_id?: number | null
}

export interface CommunityCommentSubmissionResult {
  status: Extract<CommentStatus, 'published' | 'pending'>
  message: string
  comment: CommunityComment | null
}

export interface FriendApplication {
  id: number
  name: string
  website: string
  avatar: string
  description: string
  email: string
  status: FriendApplicationStatus
  moderation_note: string
  created_at: string
  updated_at: string
}

interface CommentsResponse {
  success: boolean
  comments: CommunityComment[]
}

interface CommentSubmissionResponse {
  success: boolean
  status: Extract<CommentStatus, 'published' | 'pending'>
  message: string
  comment: CommunityComment | null
}

interface FriendApplicationsResponse {
  success: boolean
  applications: FriendApplication[]
}

const communityApi = axios.create({
  baseURL: '/api',
  timeout: 10_000,
  headers: { 'Content-Type': 'application/json' },
})

function adminHeaders(secret: string) {
  return { 'X-Admin-Secret': secret }
}

function communityClientId(): string {
  const storageKey = 'tonks_community_client_id'
  const existing = localStorage.getItem(storageKey)
  if (existing) return existing
  const generated =
    typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
  localStorage.setItem(storageKey, generated)
  return generated
}

function ensureSuccess(data: { success?: boolean; message?: string; code?: string }) {
  if (!data?.success) throw new Error(data?.message || data?.code || 'request_failed')
}

export async function getCommunityComments(
  page: CommentPage,
  secret = '',
): Promise<CommunityComment[]> {
  const { data } = await communityApi.get<CommentsResponse>(
    `/blog/community/comments/${page}`,
    secret ? { headers: adminHeaders(secret) } : undefined,
  )
  ensureSuccess(data)
  return Array.isArray(data.comments) ? data.comments : []
}

export async function submitCommunityComment(
  page: CommentPage,
  submission: CommunityCommentSubmission,
  secret = '',
): Promise<CommunityCommentSubmissionResult> {
  const { data } = await communityApi.post<CommentSubmissionResponse>(
    `/blog/community/comments/${page}`,
    {
      nickname: submission.nickname.trim(),
      email: submission.email.trim(),
      website: submission.website?.trim() || '',
      content: submission.content.trim(),
      parent_id: submission.parent_id ?? null,
    },
    {
      headers: {
        'X-Client-ID': communityClientId(),
        ...(secret ? adminHeaders(secret) : {}),
      },
    },
  )
  ensureSuccess(data)
  return {
    status: data.status,
    message: data.message,
    comment: data.comment,
  }
}

export async function moderateCommunityComment(
  id: number,
  status: Extract<CommentStatus, 'published' | 'rejected'>,
  moderationReason: string,
  secret: string,
): Promise<void> {
  const { data } = await communityApi.patch(
    `/blog/community/comments/${id}`,
    { status, moderation_reason: moderationReason },
    { headers: adminHeaders(secret) },
  )
  ensureSuccess(data)
}

export async function deleteCommunityComment(id: number, secret: string): Promise<number[]> {
  const { data } = await communityApi.delete(`/blog/community/comments/${id}`, {
    headers: adminHeaders(secret),
  })
  ensureSuccess(data)
  return Array.isArray(data.deleted) ? data.deleted : []
}

export async function getFriendApplications(
  secret: string,
  status?: FriendApplicationStatus,
): Promise<FriendApplication[]> {
  const { data } = await communityApi.get<FriendApplicationsResponse>(
    '/blog/community/friend-applications',
    {
      headers: adminHeaders(secret),
      params: status ? { status } : undefined,
    },
  )
  ensureSuccess(data)
  return Array.isArray(data.applications) ? data.applications : []
}

export async function updateFriendApplication(
  id: number,
  status: FriendApplicationStatus,
  moderationNote: string,
  secret: string,
): Promise<void> {
  const { data } = await communityApi.post(
    `/blog/community/friend-applications/${id}`,
    { status, moderation_note: moderationNote },
    { headers: adminHeaders(secret) },
  )
  ensureSuccess(data)
}

export function getCommunityAvatarUrl(commentId: number): string {
  return `/api/blog/community/avatar/${commentId}`
}
