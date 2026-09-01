const COMMUNITY_IDENTITY_KEY = 'tonks_community_identity'
const TOKEN_RE = /^[A-Za-z0-9_-]{32,128}$/

function readCookie(): string {
  const prefix = `${COMMUNITY_IDENTITY_KEY}=`
  const entry = document.cookie.split('; ').find((item) => item.startsWith(prefix))
  if (!entry) return ''
  try {
    const value = decodeURIComponent(entry.slice(prefix.length))
    return TOKEN_RE.test(value) ? value : ''
  } catch {
    return ''
  }
}

function writeCookie(token: string): void {
  const hostname = window.location.hostname.toLowerCase()
  const sharedDomain = hostname === 'tonks.top' || hostname.endsWith('.tonks.top')
  const attributes = [
    'Path=/',
    'Max-Age=31536000',
    'SameSite=Lax',
    ...(sharedDomain ? ['Domain=.tonks.top', 'Secure'] : []),
  ]
  document.cookie = `${COMMUNITY_IDENTITY_KEY}=${encodeURIComponent(token)}; ${attributes.join('; ')}`
}

function generateToken(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function getCommunityIdentityToken(): string {
  const cookieToken = readCookie()
  let localToken = ''
  try {
    const candidate = localStorage.getItem(COMMUNITY_IDENTITY_KEY) || ''
    if (TOKEN_RE.test(candidate)) localToken = candidate
  } catch {
    // Cookie remains available when local storage is restricted.
  }

  const token = cookieToken || localToken || generateToken()
  try {
    localStorage.setItem(COMMUNITY_IDENTITY_KEY, token)
  } catch {
    // The shared cookie is the primary cross-site store.
  }
  if (cookieToken !== token) writeCookie(token)
  return token
}
