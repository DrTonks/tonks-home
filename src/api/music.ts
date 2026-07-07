import { api } from './index'

export interface MusicFile {
  filename: string
  title: string
  artist: string
}

export interface MusicListResponse {
  success: boolean
  music: MusicFile[]
}

/** 获取音乐列表 */
export function getMusicList() {
  return api.get<MusicListResponse>('/music/list').then((r) => r.data)
}

/** 上传音乐（管理员） */
export function uploadMusic(file: File, title?: string, artist?: string) {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('title', title || file.name.replace(/\.[^.]+$/, ''))
  formData.append('artist', artist || 'Unknown')
  return api
    .post('/music/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    .then((r) => r.data)
}

/** 删除音乐（管理员） */
export function deleteMusic(filename: string) {
  return api.post('/music/delete', { filename }).then((r) => r.data)
}

/** 拼接流媒体 URL
 *  dev 和 prod 都走相对路径 /music/，由 vite proxy / Apache ProxyPass 转发
 */
export function getMusicStreamUrl(filename: string): string {
  return `/music/${encodeURIComponent(filename)}`
}
