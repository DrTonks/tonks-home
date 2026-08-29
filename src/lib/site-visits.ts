const SESSION_KEY = 'tonks-site-visit-id:home'

interface SiteVisitResponse {
  success: boolean
  visits: number
}

function createVisitId(): string {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID().replace(/-/g, '')
  }
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}_${Math.random().toString(36).slice(2)}`
}

function getVisitId(): string {
  try {
    const stored = sessionStorage.getItem(SESSION_KEY)
    if (stored) return stored
    const created = createVisitId()
    sessionStorage.setItem(SESSION_KEY, created)
    return created
  } catch {
    return createVisitId()
  }
}

export async function recordSiteVisit(): Promise<number> {
  const response = await fetch('/api/blog/site-visits', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'X-Site-Source': 'home',
      'X-Visit-ID': getVisitId(),
    },
  })
  if (!response.ok) {
    throw new Error(`site visit counter returned HTTP ${response.status}`)
  }
  const result = (await response.json()) as SiteVisitResponse
  if (!result.success || !Number.isFinite(result.visits)) {
    throw new Error('site visit counter returned an invalid response')
  }
  return result.visits
}
