import {describe,it,expect} from 'vitest'
import {articleMention,validateArticleIndex} from './community-articles'
import {safeCommentUrl,commentPlainText} from './community-markdown'

describe('community article references',()=>{
  it('creates portable escaped links and exact Unicode heading anchors',()=>{
    const article={title:'文章 [示例]',url:'https://blog.tonks.top/posts/writing-guide/',headings:[]}
    const result=articleMention(article,{title:'小标题',id:'重复的小标题-1'})
    expect(result).toContain('[@文章 \\[示例\\]：小标题]')
    expect(articleMention({...article,title:'&amp; 示例'})).toContain('[@\\&amp; 示例]')
    expect(new URL(result.slice(result.indexOf('](')+2,-1)).hash).toBe('#'+encodeURIComponent('重复的小标题-1'))
  })
  it('rejects forged article origins and malformed indexes',()=>{
    for(const url of ['https://evil.test/posts/a/','https://blog.tonks.top.evil.test/posts/a/','javascript:alert(1)','https://x:y@blog.tonks.top/posts/a/'])
      expect(()=>validateArticleIndex([{title:'a',url,headings:[]}])).toThrow()
    expect(validateArticleIndex([{title:'a',url:'https://blog.tonks.top/posts/a/',headings:[]}])).toHaveLength(1)
  })
  it('rejects executable links and control characters',()=>{
    for(const url of ['javascript:alert(1)','data:text/html,x','vbscript:x','java\nscript:x','https://user:pass@example.com']) expect(safeCommentUrl(url)).toBeUndefined()
    expect(safeCommentUrl('https://blog.tonks.top/posts/a/#b')).toContain('#b')
    expect(safeCommentUrl('/posts/writing-guide/')).toBe('https://blog.tonks.top/posts/writing-guide/')
  })
  it('keeps article labels readable in compact room previews',()=>{
    expect(commentPlainText('看 [@文章：小标题](https://blog.tonks.top/posts/a/#b) **不错**')).toBe('看 文章：小标题 不错')
  })
  it.each(['A & B', '&amp; &#38; &amp;amp;', '文章 [示例] *星号* _下划线_ `代码` <标签>', String.raw`路径 C:\notes\file`])('round-trips escaped article titles: %s',title=>{
    const article={title,url:'https://blog.tonks.top/posts/a/',headings:[]}
    expect(commentPlainText(articleMention(article))).toBe(title)
    const heading={title:'小节 [一] &amp; A & B',id:'section-1'}
    expect(commentPlainText(articleMention(article,heading))).toBe(`${title}：${heading.title}`)
  })
  it('preserves escaped punctuation and ordinary literal Markdown characters',()=>{
    expect(commentPlainText(String.raw`\*字面\* \_下划线\_ \~删除\~ \#标题 \>引用 \[方括号\] \&amp; C:\\notes`))
      .toBe('*字面* _下划线_ ~删除~ #标题 >引用 [方括号] &amp; C:\\notes')
    expect(commentPlainText('a_b_c C# 2 > 1 ~ 波浪')).toBe('a_b_c C# 2 > 1 ~ 波浪')
  })
  it('decodes entities once per ordinary text token without reinterpreting the result',()=>{
    expect(commentPlainText('A &amp; B &amp;amp; &#38;amp; &#x26; &lt;b&gt; &#42;星号&#42;'))
      .toBe('A & B &amp; &amp; & <b> *星号*')
    expect(commentPlainText('[**&amp;amp;** 和 \\&amp;](https://example.com)')).toBe('&amp; 和 &amp;')
  })
  it('keeps inline and fenced code literal, including entities, escapes and emoji tokens',()=>{
    const literal=String.raw`*a_b* \&amp; &amp;amp; :laopu:cry: [@文章](https://blog.tonks.top/posts/a/)`
    expect(commentPlainText('`'+literal+'`')).toBe(literal)
    expect(commentPlainText('```text\n'+literal+'\n  第二行\n```')).toBe(literal+'\n  第二行')
    expect(commentPlainText('    '+literal)).toBe(literal)
  })
  it('recursively extracts formatting and emoji labels from ordinary text and links',()=>{
    expect(commentPlainText('**好 *:laopu:happy-1:*** [~~:unicode:0:~~](https://example.com) :unknown:no:'))
      .toBe('好 [开心] 😀 :unknown:no:')
    expect(commentPlainText('[@**文章** :laopu:cry:](https://blog.tonks.top/posts/a/)')).toBe('文章 [哭哭]')
  })
  it('removes @ only for valid article mentions, including relative and reference links',()=>{
    expect(commentPlainText('[@相对](/posts/a/) [@引用][post]\n\n[post]: https://blog.tonks.top/posts/a/')).toBe('相对 引用')
    for(const url of ['https://evil.test/posts/a/','https://blog.tonks.top.evil.test/posts/a/','https://blog.tonks.top/about/','https://x:y@blog.tonks.top/posts/a/','javascript:alert(1)'])
      expect(commentPlainText(`[@保留](${url})`)).toBe('@保留')
    expect(commentPlainText('@普通 [文章](https://blog.tonks.top/posts/a/)')).toBe('@普通 文章')
  })
  it('separates block content and recursively extracts lists and table cells',()=>{
    expect(commentPlainText('# 标题\n\n> **引用**\n\n- 第一项\n  - *嵌套*\n- [x] 完成\n\n甲 | 乙\n--- | ---\n&amp; | `*字面*`'))
      .toBe('标题\n引用\n第一项\n嵌套\n完成\n甲\t乙\n&\t*字面*')
    expect(commentPlainText('第一行\n第二行\n\n下一段')).toBe('第一行\n第二行\n下一段')
    expect(commentPlainText('')).toBe('')
  })
  it('retains raw HTML as literal text and extracts image alt text',()=>{
    expect(commentPlainText('<div>&amp; :laopu:cry:</div>')).toBe('<div>&amp; :laopu:cry:</div>')
    expect(commentPlainText('![A \\& B **说明**](https://example.com/image.png)')).toBe('A & B 说明')
    expect(commentPlainText('![](https://example.com/image.png)')).toBe('[图片：查看]')
    expect(commentPlainText('![  ](https://example.com/image.png)')).toBe('[图片：查看]')
  })
})
