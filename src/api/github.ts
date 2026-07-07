import { api } from './index'

export interface ContributionDay {
  date: string
  count: number
  level: 0 | 1 | 2 | 3 | 4
}

export interface TopLanguage {
  name: string
  color: string
  stars: number
}

export interface GitHubStatsResponse {
  success: boolean
  username: string
  totalContributions: number
  days: ContributionDay[]
  topLanguages: TopLanguage[]
  error?: string
}

/** 获取 GitHub 贡献统计 */
export function getGitHubStats() {
  return api.get<GitHubStatsResponse>('/github/stats').then((r) => r.data)
}
