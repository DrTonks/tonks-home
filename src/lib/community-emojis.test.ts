import {describe,it,expect,vi} from 'vitest'
import {splitEmojiText,validateEmojiManifest} from './community-emojis'
describe('community emoji text',()=>{
  it('parses known image markers while retaining unknown markers and HTML as text',()=>{
    const parts=splitEmojiText('<script>alert(1)</script>:laopu:happy-1: :unknown:no:')
    expect(parts[0]?.text).toBe('<script>alert(1)</script>')
    expect(parts[1]?.emoji?.src).toBe('/emojis/v1/laopu/happy-1.jpg')
    expect(parts[2]?.text).toBe(' :unknown:no:')
  })
  it('handles adjacent repeated emoji and ordinary Unicode',()=>{
    expect(splitEmojiText(':laopu:cry::laopu:cry:😊').map(p=>p.emoji?.label??p.text)).toEqual(['哭哭','哭哭','😊'])
  })
  it('only permits fixed same-origin raster asset paths',()=>{
    const manifest=(src:string)=>({groups:[{id:'test',label:'test',items:[{token:':test:a:',label:'test',src}]}]})
    for(const src of ['https://evil.example/x.png','//evil.example/x.png','/emojis/v1/../a.png','/emojis/v1/test/a.svg','/emojis/v1/test/a.png?x=1'])expect(()=>validateEmojiManifest(manifest(src))).toThrow()
    expect(validateEmojiManifest(manifest('/emojis/v1/test/a.gif'))[0]?.items[0]?.src).toContain('a.gif')
  })
  it('rejects duplicate tokens and malformed groups',()=>{
    const item={token:':test:a:',label:'a',text:'<b>safe text</b>'}
    expect(()=>validateEmojiManifest({groups:[{label:'x',items:[item]}]})).toThrow()
    expect(()=>validateEmojiManifest({groups:[{id:'test',label:'x',items:[item,item]}]})).toThrow()
  })
  it('excludes retired groups when loading a legacy manifest, including recent and inline emoji',async()=>{
    const retired=['weibo','alu','kaomoji'].map(id=>({id,label:id,items:[{token:`:${id}:a:`,label:id,src:`/emojis/v1/${id}/a.png`}]}))
    const retained={id:'laopu',label:'老普专用',items:[{token:':laopu:cry:',label:'哭哭',src:'/emojis/v1/laopu/cry.jpg'}]}
    const manifest={groups:[...retired,retained]}
    expect(validateEmojiManifest(manifest)).toEqual([retained])
    vi.resetModules()
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>manifest}))
    vi.stubGlobal('localStorage',{getItem:()=>JSON.stringify([...retired.map(g=>g.items[0]!.token),':laopu:cry:'])})
    try {
      const emojis=await import('./community-emojis')
      await emojis.loadEmojiManifest()
      expect(emojis.getEmojiGroups()).toEqual([retained])
      expect(emojis.recentEmojis()).toEqual(retained.items)
      expect(emojis.splitEmojiText(':weibo:a::alu:a::kaomoji:a:')).toEqual([{text:':weibo:a::alu:a::kaomoji:a:'}])
      expect(emojis.splitEmojiText(':laopu:cry:')[0]?.emoji).toEqual(retained.items[0])
    } finally {
      vi.unstubAllGlobals()
      vi.resetModules()
    }
  })
})
