const STORAGE_KEY = 'tonks_friend_application_tokens'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365
const MAX_TOKENS = 20

function normalizeTokens(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return [
    ...new Set(
      value
        .map((item) => String(item || '').trim())
        .filter((item) => /^[A-Za-z0-9_-]{32,128}$/.test(item)),
    ),
  ].slice(-MAX_TOKENS)
}

function readCookieTokens(): string[] {
  const prefix = `${STORAGE_KEY}=`
  const entry = document.cookie.split('; ').find((item) => item.startsWith(prefix))
  if (!entry) return []
  try {
    return normalizeTokens(JSON.parse(decodeURIComponent(entry.slice(prefix.length))))
  } catch {
    return []
  }
}

function writeCookieTokens(tokens: string[]) {
  const hostname = window.location.hostname.toLowerCase()
  const sharedDomain = hostname === 'tonks.top' || hostname.endsWith('.tonks.top')
  const attributes = [
    'Path=/',
    `Max-Age=${COOKIE_MAX_AGE}`,
    'SameSite=Lax',
    ...(sharedDomain ? ['Domain=.tonks.top', 'Secure'] : []),
  ]
  document.cookie = `${STORAGE_KEY}=${encodeURIComponent(JSON.stringify(tokens))}; ${attributes.join('; ')}`
}

export function readFriendApplicationTokens(): string[] {
  let localTokens: string[] = []
  try {
    localTokens = normalizeTokens(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'))
  } catch {
    localStorage.removeItem(STORAGE_KEY)
  }
  return normalizeTokens([...readCookieTokens(), ...localTokens])
}

export function rememberFriendApplicationToken(token: string): string[] {
  const tokens = normalizeTokens([...readFriendApplicationTokens(), token])
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens))
  writeCookieTokens(tokens)
  return tokens
}
