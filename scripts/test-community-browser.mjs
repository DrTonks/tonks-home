// Run with PLAYWRIGHT_MODULE_PATH pointing to playwright's index.mjs if it is
// supplied by the host; otherwise install Playwright locally. Uses local mock
// data only and aborts all non-local requests. No production comments are sent.
import assert from 'node:assert/strict'
import {pathToFileURL} from 'node:url'
import {createServer} from 'vite'
const runtime=process.env.PLAYWRIGHT_MODULE_PATH
const {chromium}=await import(runtime?pathToFileURL(runtime).href:'playwright')
const server=await createServer({server:{host:'127.0.0.1',port:0,open:false,hmr:false}})
let browser
try {
  await server.listen()
  const origin=`http://127.0.0.1:${server.httpServer.address().port}`
  browser=await chromium.launch({channel:'msedge',headless:true})
  const page=await browser.newPage({viewport:{width:900,height:800}})
  page.setDefaultTimeout(10000)
  const errors=[];page.on('pageerror',error=>errors.push(error.message))
  let releaseImage,releaseManifest,releaseHistoryImage
  let holdManifest=false,holdImage=false
  const delayedImage=new Promise(resolve=>releaseImage=resolve)
  const delayedManifest=new Promise(resolve=>releaseManifest=resolve)
  const historyImage=new Promise(resolve=>releaseHistoryImage=resolve)
  await page.context().route('**/*',async route=>{
    const url=new URL(route.request().url())
    if(url.origin!==origin) return route.abort()
    if(url.pathname.startsWith('/api/')) {
      const comments=Array.from({length:20},(_,i)=>({id:i+1,page:'about',parent_id:null,root_id:i+1,nickname:'本地测试',website:'',content:`测试留言 ${i+1}`,created_at:'2026-09-08T00:00:00Z',status:'published',author_key:'test',owned:false,is_admin:false,reply_to_name:''}))
      return route.fulfill({contentType:'application/json',body:JSON.stringify({success:true,status:'published',message:'已发送',comments,room_messages:comments,topics:[]})})
    }
    if(url.pathname==='/community/articles.json')return route.fulfill({contentType:'application/json',body:JSON.stringify([{title:'文章样式备忘录',url:'https://blog.tonks.top/posts/writing-guide/',headings:[{title:'测试小标题',id:'section-one'}]}])})
    if(url.pathname==='/emojis/manifest.json' && holdManifest) await delayedManifest
    if(['/delayed-image.png','/history-image.png'].includes(url.pathname)) {
      if(url.pathname==='/history-image.png')await historyImage
      else if(holdImage)await delayedImage
      return route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="360" height="360"><rect width="360" height="360" fill="blue"/></svg>'})
    }
    return route.continue()
  })
  await page.goto(origin+'/tests/community-regression.html')
  await page.waitForFunction(()=>!!window.communityTest)
  const assertOverflow=async()=>assert(await page.locator('.feedback-stream').evaluate(el=>el.scrollHeight>el.clientHeight+100),'fixture must actually overflow')
  const assertBottom=async()=>{
    // A viewport API call can return before its layout is presented. Let two
    // render frames settle before accepting a transient old-layout bottom.
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))))
    try {await page.waitForFunction(()=>{const el=document.querySelector('.feedback-stream');return el.scrollHeight-el.clientHeight-el.scrollTop<2})}
    catch(error) {console.error('Scroll diagnostic',await page.locator('.feedback-stream').evaluate(el=>({top:el.scrollTop,height:el.clientHeight,scrollHeight:el.scrollHeight,anchor:getComputedStyle(el).overflowAnchor,behavior:getComputedStyle(el).scrollBehavior})));throw error}
  }
  await assertOverflow();await assertBottom()
  for(let i=0;i<2;i++) {
    await page.setViewportSize({width:1200,height:900});await assertBottom()
    await page.setViewportSize({width:1200,height:390});await assertOverflow();await assertBottom()
    await page.evaluate(()=>{const s=window.communityTest.state;s.messages.push({...s.messages[0],id:300+s.messages.length,content:'窗口缩小后继续跟随'})})
    await assertBottom()
  }
  await page.setViewportSize({width:900,height:800});await assertBottom()
  const escapePicker=async button=>{
    await button.click()
    assert(await page.getByRole('textbox',{name:'搜索表情'}).evaluate(el=>document.activeElement===el),'picker must receive focus on open')
    await page.keyboard.press('Escape')
    await page.locator('.community-emoji-picker').waitFor({state:'detached'})
  }
  await escapePicker(page.getByRole('button',{name:'选择表情',exact:true}))
  const result=await page.evaluate(()=>{
    const el=document.createElement('div'), render=window.communityTest.renderCommunityMarkdown
    render(el,'&amp; &#x41; &NotEqualTilde; &amp;lt; \\&amp;\n\n`&amp;`\n\n```\n&#x41;\n```\n\n[link](https://example.test/?a=1&amp;b=2)\n\n[x](jav&#x61;script:alert(1))\n\n&lt;img src=x onerror=alert(1)&gt;')
    return {text:el.textContent,code:[...el.querySelectorAll('code')].map(e=>e.textContent),hrefs:[...el.querySelectorAll('a')].map(e=>e.href),images:el.querySelectorAll('img').length}
  })
  assert(result.text.includes('& A ≂̸ &lt; &amp;'))
  assert.deepEqual(result.code,['&amp;','&#x41;'])
  assert.deepEqual(result.hrefs,['https://example.test/?a=1&b=2']);assert.equal(result.images,0)
  // A linked card has separate native controls; activating links never opens it.
  const popupReady=page.waitForEvent('popup')
  await page.locator('.qq-feedback-card a').click({noWaitAfter:true})
  await (await popupReady).close()
  assert.equal(await page.locator('.feedback-detail-layer').count(),0)
  await page.getByRole('button',{name:'打开反馈：反馈交互回归'}).click()
  assert.equal(await page.locator('.feedback-detail-layer').count(),1)
  await escapePicker(page.locator('.feedback-detail-layer').getByRole('button',{name:'选择表情',exact:true}))
  await page.keyboard.press('Escape')
  // Reload to close the modal and cover delayed-image layout changes.
  await page.reload();await page.waitForFunction(()=>!!window.communityTest)
  await assertOverflow();await assertBottom()
  await page.evaluate(()=>{
    const s=window.communityTest.state
    s.topics.push(...Array.from({length:24},(_,i)=>({...s.topics[0],id:i+2,status:i%2?'open':'resolved',title:`筛选反馈 ${i+2}`})))
  })
  for(let i=0;i<3;i++) {
    await page.getByRole('button',{name:'已完成',exact:true}).click()
    await assertOverflow();await assertBottom()
    await page.getByRole('button',{name:'全部',exact:true}).click()
    await assertOverflow();await assertBottom()
  }
  holdImage=true
  await page.evaluate(origin=>{
    const state=window.communityTest.state
    state.messages.push({...state.messages[0],id:99,content:`![延迟图片](${origin}/delayed-image.png)`})
  },origin)
  await page.waitForTimeout(200)
  await page.locator('.feedback-stream').evaluate(el=>{el.scrollTop=el.scrollHeight})
  releaseImage()
  await page.waitForFunction(()=>{const img=document.querySelector('.community-markdown-image');return img?.complete&&img.naturalWidth>0})
  await page.waitForTimeout(150)
  const gap=await page.locator('.feedback-stream').evaluate(el=>el.scrollHeight-el.clientHeight-el.scrollTop)
  assert(gap<2,`image loaded bottom gap: ${gap}`)
  await page.locator('.feedback-stream').evaluate(el=>{el.scrollTop=0})
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))))
  await page.evaluate(()=>{const s=window.communityTest.state;s.messages.push({...s.messages[0],id:100,content:'新消息不能打断上翻'})})
  await page.waitForTimeout(150)
  assert.equal(await page.locator('.feedback-stream').evaluate(el=>el.scrollTop),0)
  await page.locator('.feedback-stream').evaluate(el=>{el.scrollTop=el.scrollHeight})
  await assertBottom()
  await page.locator('.feedback-stream').hover({position:{x:200,y:150}})
  await page.mouse.wheel(0,-180)
  await page.waitForFunction(()=>{const el=document.querySelector('.feedback-stream');return el.scrollHeight-el.clientHeight-el.scrollTop>80})
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))))
  assert(await page.locator('.feedback-stream').evaluate(el=>el.scrollHeight-el.clientHeight-el.scrollTop>80),'first upward wheel after manual return to bottom must remain in history')
  await page.getByRole('button',{name:'发送反馈卡片',exact:true}).click()
  await escapePicker(page.locator('.feedback-card-composer').getByRole('button',{name:'选择表情',exact:true}))
  await page.locator('.feedback-card-composer').getByRole('button',{name:'选择表情',exact:true}).click()
  const checkPanel=async()=>{
    await page.waitForFunction(()=>{const r=document.querySelector('.community-emoji-picker')?.getBoundingClientRect();return r && r.x>=0 && r.right<=window.innerWidth+1 && r.y>=0 && r.bottom<=window.innerHeight+1})
    const rect=await page.locator('.community-emoji-picker').boundingBox()
    assert(rect.x>=0&&rect.x+rect.width<=page.viewportSize().width+1)
    assert(rect.y>=0&&rect.y+rect.height<=page.viewportSize().height+1)
    const clickable=await page.getByRole('button',{name:'关闭表情面板'}).evaluate(el=>{const r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))})
    assert(clickable)
  }
  await checkPanel();await page.setViewportSize({width:390,height:844});await checkPanel()
  await page.getByRole('button',{name:'开心',exact:true}).click()
  assert((await page.locator('.feedback-card-composer textarea').inputValue()).includes(':laopu:happy-1:'))
  assert.equal(await page.locator('.community-emoji-picker').count(),0)
  // Images above the reader should preserve the visible message's position.
  await page.setViewportSize({width:900,height:800})
  await page.goto(origin+'/tests/community-regression.html')
  await page.waitForFunction(()=>!!window.communityTest);await assertBottom()
  await page.evaluate(origin=>{window.communityTest.state.messages[0].content=`![历史图片](${origin}/history-image.png)`},origin)
  await page.locator('.community-markdown-image').waitFor({state:'attached'})
  await page.locator('.feedback-stream').evaluate(el=>{el.scrollTop=900})
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))))
  const anchorY=await page.evaluate(()=>{
    const stream=document.querySelector('.feedback-stream').getBoundingClientRect()
    window.historyAnchor=[...document.querySelectorAll('.feedback-room-message')].find(el=>{const r=el.getBoundingClientRect();return r.top>stream.top+80&&r.bottom<stream.bottom})
    return window.historyAnchor.getBoundingClientRect().top
  })
  assert.equal(await page.locator('.feedback-stream').evaluate(el=>getComputedStyle(el).overflowAnchor),'auto')
  releaseHistoryImage()
  await page.waitForFunction(()=>{const img=document.querySelector('.community-markdown-image');return img?.complete&&img.naturalWidth>0})
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))))
  assert(Math.abs(await page.evaluate(()=>window.historyAnchor.getBoundingClientRect().top)-anchorY)<2,'history image must preserve the visible reading anchor')
  // A reply initially uses the fallback index, then updates without prop changes.
  holdManifest=true
  await page.goto(origin+'/tests/community-regression.html?surface=reply')
  await page.locator('.message-quote').waitFor()
  assert((await page.locator('.message-quote').textContent()).includes(':bilibili:'))
  releaseManifest()
  await page.waitForFunction(()=>!document.querySelector('.message-quote').textContent.includes(':bilibili:'))
  await page.evaluate(()=>window.communityTest.unmount())
  assert.equal(await page.locator('.community-emoji-picker').count(),0)
  // The real outer Dialog is essential: body portals used to fall outside its
  // pointer and focus boundary, a failure isolated composers cannot reproduce.
  holdManifest=false
  await page.setViewportSize({width:1280,height:900})
  await page.goto(origin+'/tests/community-regression.html?surface=dialog')
  await page.locator('.qq-community-window').waitFor()
  const modal=page.locator('.qq-community-window')
  const insertPickers=async(scope,input)=>{
    await scope.getByRole('button',{name:'选择表情',exact:true}).click()
    const emoji=page.locator('.community-emoji-picker')
    assert(await emoji.evaluate(el=>!!el.closest('[data-community-overlay-root]')))
    await emoji.getByRole('button',{name:'开心',exact:true}).hover()
    assert(await emoji.getByRole('button',{name:'开心',exact:true}).evaluate(el=>el.matches(':hover')))
    await emoji.getByRole('button',{name:'开心',exact:true}).click()
    assert((await input.inputValue()).includes(':laopu:happy-1:'))
    assert(await modal.isVisible())
    await scope.getByRole('button',{name:'引用文章或小标题',exact:true}).click()
    const article=page.locator('.community-article-picker:visible')
    await article.getByRole('button',{name:'小标题 (1)',exact:true}).click()
    await article.getByRole('button',{name:'文章样式备忘录：测试小标题',exact:true}).click()
    assert((await input.inputValue()).includes('[@文章样式备忘录：测试小标题]'))
    assert(await modal.isVisible())
  }
  await insertPickers(modal,page.locator('.qq-composer-input'))
  await page.getByRole('button',{name:/Friends 群头像/}).click()
  await insertPickers(modal,page.locator('.qq-composer-input'))
  await page.getByRole('button',{name:/Feedback 群头像/}).click()
  await insertPickers(modal,page.locator('.feedback-composer > textarea'))
  const before=await page.locator('.feedback-stream').evaluate(el=>({height:el.clientHeight,top:el.scrollTop}))
  await modal.getByRole('button',{name:'发送反馈卡片',exact:true}).click()
  const card=page.locator('.feedback-card-composer')
  await card.waitFor()
  const after=await page.locator('.feedback-stream').evaluate(el=>({height:el.clientHeight,top:el.scrollTop}))
  assert.deepEqual(after,before,'opening feedback composer must not resize or move messages')
  await insertPickers(card,card.locator('textarea'))
  await page.screenshot({path:'.tmp/community-ui-home.png'})
  await page.setViewportSize({width:390,height:844})
  await page.waitForFunction(()=>{const r=document.querySelector('.feedback-card-composer').getBoundingClientRect();const root=document.querySelector('.qq-community-window').getBoundingClientRect();return r.left>=root.left&&r.right<=root.right+1&&r.top>=root.top&&r.bottom<=root.bottom+1})
  await insertPickers(card,card.locator('textarea'))
  await page.getByRole('button',{name:'收起反馈卡片',exact:true}).click()
  assert(await modal.isVisible())
  await page.evaluate(()=>window.communityTest.unmount())
  assert.equal(await page.locator('.community-emoji-picker,.community-article-picker,.feedback-card-composer').count(),0)
  assert.deepEqual(errors,[])
  console.log('PASS: overflowing fixture, filter scroll, three picker focus/Escape entries, entities, safe URLs, code literals, card links, delayed images, history scroll, 900/390px picker, insertion, reactive reply, cleanup')
} finally {await browser?.close();await server.close()}

