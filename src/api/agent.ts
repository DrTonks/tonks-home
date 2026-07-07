import { api } from './index'

export interface AgentActivity {
  date: string
  messageCount: number
  sessionCount: number
  toolCallCount: number
  intensity: 0 | 1 | 2 | 3 | 4
}

export interface AgentActivityResponse {
  success: boolean
  activities: AgentActivity[]
  note?: string
}

/** 获取 Agent 活动热力图数据 */
export function getAgentActivity() {
  return api.get<AgentActivityResponse>('/agent-activity').then((r) => r.data)
}

/** 上传 Agent 活动数据（管理员） */
export function uploadAgentActivity(data: AgentActivity[] | { dailyActivity: AgentActivity[] }) {
  return api.post('/agent-activity', data).then((r) => r.data)
}
