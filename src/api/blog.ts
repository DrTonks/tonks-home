import { api } from './index'

export interface BlogPost {
  title: string
  link: string
  date: string
  summary: string
}

export interface BlogLink {
  name: string
  url: string
  type: string
}

export interface FeaturedProject {
  id: string
  title: string
  description: string
  image?: string
  category?: string
  techStack?: string[]
  status?: string
  startDate?: string
  endDate?: string
  tags?: string[]
  award?: string
  featured?: boolean
  links: BlogLink[]
  images: string[]
}

export interface FeaturedTimeline {
  id: string
  title: string
  description: string
  type: string
  startDate: string
  icon?: string
  location?: string
  organization?: string
  position?: string
  achievements?: string[]
  color?: string
  links: BlogLink[]
  images: string[]
}

export interface BlogPostsResponse {
  success: boolean
  count: number
  posts: BlogPost[]
  featuredProject: FeaturedProject | null
  featuredTimeline: FeaturedTimeline | null
}

/** 获取博客文章 + 精选项目/时光机 */
export function getBlogPosts(count = 2) {
  return api.get<BlogPostsResponse>('/blog-posts', { params: { count } }).then((r) => r.data)
}

/** 拼接图片 URL（项目图、时光机图等，走 /images/<filename> 接口）
 *  dev 和 prod 都走相对路径 /images/，由 vite proxy / Apache ProxyPass 转发
 */
export function getImageUrl(path: string | undefined | null): string {
  if (!path) return ''
  if (path.startsWith('http')) return path
  return path.startsWith('/') ? path : `/${path}`
}
