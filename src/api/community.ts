import axios from 'axios'
import { getCommunityIdentityToken } from '@/lib/community-identity'

export type CommentPage = 'about' | 'friends'
export type CommentStatus = 'published' | 'pending' | 'rejected'
export type FriendApplicationStatus = 'pending' | 'approved' | 'rejected'
export type FeedbackKind = 'bug' | 'suggestion' | 'content' | 'other'
export type FeedbackStatus = 'open' | 'in_progress' | 'resolved' | 'merged'

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
  owned: boolean
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

export interface FriendApplicationSubmission {
  name: string
  website: string
  avatar?: string
  description: string
  email: string
}

export type TrackedFriendApplication = Omit<FriendApplication, 'email'>

export interface FriendApplicationSubmissionResult {
  application: TrackedFriendApplication
  trackingToken: string
  message: string
}

export interface FeedbackMessage {
  id: number
  topic_id: number
  nickname: string
  email?: string
  website: string
  content: string
  status: CommentStatus
  is_admin: boolean
  owned: boolean
  author_key: string
  created_at: string
  moderation_reason?: string
}

export interface FeedbackRoomMessage {
  id: number
  nickname: string
  email?: string
  website: string
  content: string
  status: CommentStatus
  is_admin: boolean
  owned: boolean
  author_key: string
  created_at: string
  moderation_reason?: string
}

export interface FeedbackSourceComment {
  id: number
  parent_id: number | null
  root_id: number
  nickname: string
  website: string
  content: string
  is_admin: boolean
  author_key: string
  created_at: string
}

export interface FeedbackSource {
  id: number
  page: CommentPage
  root_comment_id: number
  comments: FeedbackSourceComment[]
  created_at: string
}

export interface FeedbackEvent {
  id: number
  type: string
  detail: string
  created_at: string
}

export interface FeedbackTopic {
  id: number
  title: string
  kind: FeedbackKind
  status: FeedbackStatus
  nickname: string
  email?: string
  website: string
  is_admin: boolean
  owned: boolean
  author_key: string
  resolution_note: string
  merged_into_id: number | null
  created_at: string
  updated_at: string
  messages: FeedbackMessage[]
  sources: FeedbackSource[]
  events: FeedbackEvent[]
}

export interface FeedbackMessageSubmission {
  nickname: string
  email: string
  website?: string
  content: string
}

export interface FeedbackTopicSubmission extends FeedbackMessageSubmission {
  title: string
  kind: FeedbackKind
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

interface FriendApplicationSubmissionResponse {
  success: boolean
  application: TrackedFriendApplication
  tracking_token: string
  message: string
}

interface TrackedFriendApplicationsResponse {
  success: boolean
  applications: TrackedFriendApplication[]
}

interface CommunityAvatarPreviewResponse {
  success: boolean
  avatar_url: string
}

interface FeedbackTopicsResponse {
  success: boolean
  topics: FeedbackTopic[]
  room_messages: FeedbackRoomMessage[]
}

export interface FeedbackRoomState {
  topics: FeedbackTopic[]
  messages: FeedbackRoomMessage[]
}

const communityApi = axios.create({
  baseURL: '/api',
  timeout: 10_000,
  headers: { 'Content-Type': 'application/json' },
})

function adminHeaders(secret: string) {
  return { 'X-Admin-Secret': secret }
}

function commentHeaders(secret = '') {
  return {
    'X-Client-ID': communityClientId(),
    'X-Community-Identity': getCommunityIdentityToken(),
    ...(secret ? adminHeaders(secret) : {}),
  }
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
  const { data } = await communityApi.get<CommentsResponse>(`/blog/community/comments/${page}`, {
    headers: commentHeaders(secret),
  })
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
        ...commentHeaders(secret),
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

export async function submitFriendApplication(
  submission: FriendApplicationSubmission,
): Promise<FriendApplicationSubmissionResult> {
  const { data } = await communityApi.post<FriendApplicationSubmissionResponse>(
    '/blog/community/friend-applications',
    {
      name: submission.name.trim(),
      website: submission.website.trim(),
      avatar: submission.avatar?.trim() || '',
      description: submission.description.trim(),
      email: submission.email.trim(),
    },
    { headers: { 'X-Client-ID': communityClientId() } },
  )
  ensureSuccess(data)
  return {
    application: data.application,
    trackingToken: data.tracking_token,
    message: data.message,
  }
}

export async function getTrackedFriendApplications(
  tokens: string[],
): Promise<TrackedFriendApplication[]> {
  if (!tokens.length) return []
  const { data } = await communityApi.post<TrackedFriendApplicationsResponse>(
    '/blog/community/friend-applications/status',
    { tokens },
  )
  ensureSuccess(data)
  return Array.isArray(data.applications) ? data.applications : []
}

export function getCommunityAvatarUrl(commentId: number): string {
  return `/api/blog/community/avatar/${commentId}`
}

export async function getCommunityAvatarPreview(email: string): Promise<string> {
  const { data } = await communityApi.post<CommunityAvatarPreviewResponse>(
    '/blog/community/avatar-preview',
    { email: email.trim() },
  )
  ensureSuccess(data)
  return data.avatar_url
}

export async function getFeedbackTopics(secret = ''): Promise<FeedbackRoomState> {
  const { data } = await communityApi.get<FeedbackTopicsResponse>('/blog/community/feedback', {
    headers: commentHeaders(secret),
  })
  ensureSuccess(data)
  return {
    topics: Array.isArray(data.topics) ? data.topics : [],
    messages: Array.isArray(data.room_messages) ? data.room_messages : [],
  }
}

export async function addFeedbackRoomMessage(
  submission: FeedbackMessageSubmission,
  secret = '',
): Promise<{ status: Extract<CommentStatus, 'published' | 'pending'>; message: string }> {
  const { data } = await communityApi.post(
    '/blog/community/feedback/messages',
    {
      ...submission,
      content: submission.content.trim(),
      nickname: submission.nickname.trim(),
      email: submission.email.trim(),
      website: submission.website?.trim() || '',
    },
    { headers: commentHeaders(secret) },
  )
  ensureSuccess(data)
  return { status: data.status, message: data.message }
}

export async function createFeedbackTopic(
  submission: FeedbackTopicSubmission,
  secret = '',
): Promise<{ status: Extract<CommentStatus, 'published' | 'pending'>; message: string }> {
  const { data } = await communityApi.post(
    '/blog/community/feedback',
    {
      ...submission,
      title: submission.title.trim(),
      content: submission.content.trim(),
      nickname: submission.nickname.trim(),
      email: submission.email.trim(),
      website: submission.website?.trim() || '',
    },
    { headers: commentHeaders(secret) },
  )
  ensureSuccess(data)
  return { status: data.status, message: data.message }
}

export async function addFeedbackMessage(
  topicId: number,
  submission: FeedbackMessageSubmission,
  secret = '',
): Promise<{ status: Extract<CommentStatus, 'published' | 'pending'>; message: string }> {
  const { data } = await communityApi.post(
    `/blog/community/feedback/${topicId}/messages`,
    {
      ...submission,
      content: submission.content.trim(),
      nickname: submission.nickname.trim(),
      email: submission.email.trim(),
      website: submission.website?.trim() || '',
    },
    { headers: commentHeaders(secret) },
  )
  ensureSuccess(data)
  return { status: data.status, message: data.message }
}

export async function updateFeedbackTopic(
  topicId: number,
  update: Partial<Pick<FeedbackTopic, 'title' | 'kind' | 'status' | 'resolution_note'>>,
  secret: string,
): Promise<void> {
  const { data } = await communityApi.patch(`/blog/community/feedback/${topicId}`, update, {
    headers: adminHeaders(secret),
  })
  ensureSuccess(data)
}

export async function deleteFeedbackTopic(topicId: number, secret: string): Promise<number[]> {
  const { data } = await communityApi.delete(`/blog/community/feedback/${topicId}`, {
    headers: adminHeaders(secret),
  })
  ensureSuccess(data)
  return Array.isArray(data.deleted) ? data.deleted.map(Number) : []
}

export async function convertCommentTreeToFeedback(
  rootCommentId: number,
  options: { topicId?: number; title?: string; kind?: FeedbackKind },
  secret: string,
): Promise<number> {
  const { data } = await communityApi.post(
    '/blog/community/feedback/from-comment',
    {
      root_comment_id: rootCommentId,
      topic_id: options.topicId,
      title: options.title,
      kind: options.kind,
    },
    { headers: adminHeaders(secret) },
  )
  ensureSuccess(data)
  return Number(data.topic_id)
}

export async function mergeFeedbackTopics(
  targetTopicId: number,
  sourceTopicIds: number[],
  title: string,
  secret: string,
): Promise<void> {
  const { data } = await communityApi.post(
    '/blog/community/feedback/merge',
    {
      target_topic_id: targetTopicId,
      source_topic_ids: sourceTopicIds,
      ...(title.trim() ? { title: title.trim() } : {}),
    },
    { headers: adminHeaders(secret) },
  )
  ensureSuccess(data)
}

export function getFeedbackAvatarUrl(messageId: number): string {
  return `/api/blog/community/feedback/avatar/${messageId}`
}

export function getFeedbackRoomAvatarUrl(messageId: number): string {
  return `/api/blog/community/feedback/room-avatar/${messageId}`
}
