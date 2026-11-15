import {test, expect} from 'vitest'
import {profile, searchHead, searchBody} from './search-artifacts.mjs'
import {checkSearchHtml} from './search-html.mjs'

test('public HTML checks accept escaped descriptions and query parameters without accepting missing links', () => {
 const originalDescription = profile.description
 const originalLinks = profile.links
 try {
  profile.description = '公开资料 A & B <测试> "简介"'
  profile.links = [{title: '查询', url: 'https://example.com/search?q=agent&lang=zh', description: '公开查询'}]
  const html = searchHead() + searchBody()
  expect(html).toContain('q=agent&amp;lang=zh')
  expect(() => checkSearchHtml(html, profile)).not.toThrow()
  expect(() => checkSearchHtml(html.replace('href="https://example.com/search?q=agent&amp;lang=zh"', 'href="/"'), profile)).toThrow()
 } finally {
  profile.description = originalDescription
  profile.links = originalLinks
 }
})

test('404 reuses built assets without claiming homepage identity', async () => {
 const {errorDocument} = await import('./error-document.mjs')
 const built = `<html><head><title>Home</title>${searchHead()}<script type="module" crossorigin src="/assets/main-abcd.js"></script><link rel="stylesheet" href="/assets/main-abcd.css"></head><body>home</body></html>`
 const html = errorDocument(built)
 expect(html).toContain('/assets/main-abcd.js')
 expect(html).toContain('/assets/main-abcd.css')
 expect(html).toContain('name="robots" content="noindex, follow"')
 expect(html).toContain('id="static-not-found"')
 expect(html).not.toContain('rel="canonical"')
 expect(html).not.toContain('application/ld+json')
 expect(html).not.toContain('property="og:')
 expect(() => errorDocument('<html><head></head></html>')).toThrow()
})
