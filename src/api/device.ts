import { api } from './index'

export interface StatusInfo {
  id: number
  name: string
  desc: string
  color: string
}

export interface QueryResponse {
  success: boolean
  status: number
  info: StatusInfo | { status: number; name: string }
  timestamp: number | null
}

export interface OnlineCountResponse {
  success: boolean
  online_count: number
  mobile_count: number
}

/** 获取当前 PC 状态 */
export function getQuery() {
  return api.get<QueryResponse>('/query').then((r) => r.data)
}

/** 获取全部状态定义 */
export function getStatusList() {
  return api.get<StatusInfo[]>('/get/status_list').then((r) => r.data)
}

/** 获取在线人数 */
export function getOnlineCount() {
  return api.get<OnlineCountResponse>('/online_count').then((r) => r.data)
}

/** 更新 PC 状态（PC 密钥，非管理员） */
export function updateStatus(params: { secret: string; status: number; app_name: string; timestamp?: number }) {
  return api.get('/set', { params }).then((r) => r.data)
}
