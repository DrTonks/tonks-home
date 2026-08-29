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
  created_at: string
  reply_to_name: string
  moderation_reason?: string
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
