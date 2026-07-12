import { api } from './index'

export interface MusicFile {
  filename: string
  title: string
  artist: string
  hasLyrics?: boolean
}

export interface MusicListResponse {
  success: boolean
  music: MusicFile[]
}

/** 获取音乐列表 */
export function getMusicList() {
  return api.get<MusicListResponse>('/music/list').then((r) => r.data)
}

/** 上传音乐（管理员）；可选一并上传 LRC 歌词，无则为纯音乐 */
export function uploadMusic(file: File, title?: string, artist?: string, lyrics?: File | null) {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('title', title || file.name.replace(/\.[^.]+$/, ''))
  formData.append('artist', artist || 'Unknown')
  if (lyrics) formData.append('lyrics', lyrics)
  return api
    .post('/music/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    .then((r) => r.data)
}

/** 获取 LRC 歌词纯文本；无歌词时后端返回 not found，这里兜底成空串 */
export function getLyrics(filename: string): Promise<string> {
  return api
    .get(`/music/lyrics/${encodeURIComponent(filename)}`, { responseType: 'text' })
    .then((r) => (typeof r.data === 'string' ? r.data : ''))
    .catch(() => '')
}

/** 删除音乐（管理员） */
export function deleteMusic(filename: string) {
  return api.post('/music/delete', { filename }).then((r) => r.data)
}

/** 调整播放顺序（管理员）：传完整的 filename 顺序数组 */
export function reorderMusic(order: string[]) {
  return api.post('/music/reorder', { order }).then((r) => r.data)
}

/** 拼接流媒体 URL
 *  dev 和 prod 都走相对路径 /music/，由 vite proxy / Apache ProxyPass 转发
 */
export function getMusicStreamUrl(filename: string): string {
  return `/music/${encodeURIComponent(filename)}`
}
