import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

const root=fileURLToPath(new URL('../dist/',import.meta.url));
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href);
// Local static-server fixture models Apache's internal ErrorDocument response.
// It tests the real built bundle, not production Apache configuration itself.
const server=createServer(async(req,res)=>{
 try {
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  const file=resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
  if(!file.startsWith(resolve(root)+sep))throw new Error('Invalid path');
  let bytes,status=200,type;
  try {if(!(await stat(file)).isFile())throw new Error('Missing file');bytes=await readFile(file);type=({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.txt':'text/plain','.md':'text/markdown','.woff2':'font/woff2','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml'})[extname(file)]||'application/octet-stream';}
  catch {bytes=await readFile(resolve(root,'404.html'));status=404;type='text/html';}
  res.writeHead(status,{'Content-Type':type,'Cache-Control':'no-store'});res.end(bytes);
 } catch {res.writeHead(400);res.end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({channel:'msedge',headless:true});
async function context(options={}){
 const c=await browser.newContext(options);
 await c.route('**/*',r=>new URL(r.request().url()).origin===origin&&!new URL(r.request().url()).pathname.startsWith('/api/')?r.continue():r.abort());
 return c;
}
try {
 const nojs=await context({javaScriptEnabled:false});const np=await nojs.newPage();
 assert.equal((await np.goto(origin+'/missing/deep/page')).status(),404);
 assert.equal(await np.locator('#static-not-found h1').textContent(),'404');
 assert.equal(await np.locator('meta[name="robots"]').getAttribute('content'),'noindex, follow');
 assert.equal(await np.locator('link[rel="canonical"]').count(),0);await nojs.close();
 for(const viewport of [{width:1280,height:900},{width:390,height:844}]){
  const c=await context({viewport});const p=await c.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));
  assert.equal((await p.goto(origin+'/404')).status(),404);
  await p.locator('.glitch-main').waitFor({state:'visible'});await p.waitForTimeout(1700);
  assert.equal(await p.locator('#static-not-found').count(),0);
  assert.equal(await p.locator('.glitch-overlay').count(),2);
  assert.equal(await p.locator('.star').count(),30);
  assert.equal(await p.locator('meta[name="robots"]').getAttribute('content'),'noindex, follow');
  assert.equal(await p.title(),'404 · 页面未找到 - DrTonks');
  const link=p.getByRole('link',{name:/回到首页/});assert.match(await link.textContent(),/\d+ 秒后自动返回/);
  const metrics=await p.locator('.glitch-main').evaluate(el=>({font:getComputedStyle(el).fontFamily,size:getComputedStyle(el).fontSize,animations:getComputedStyle(el).animationName}));
  assert.match(metrics.font,/JB-404/);assert.match(metrics.animations,/glitch-in/);
  await p.screenshot({path:`.tmp/404-fixed-${viewport.width}.png`});
  if(viewport.width===1280){
   await Promise.all([p.waitForURL(origin+'/'),link.click()]);
   await p.waitForFunction(()=>document.querySelector('meta[name="robots"]')?.content==='index, follow');
   await p.evaluate(()=>document.querySelector('#app').__vue_app__.config.globalProperties.$router.push('/missing/deep/page'));
   await p.locator('.glitch-main').waitFor({state:'visible'});
   assert.equal(await p.locator('meta[name="robots"]').getAttribute('content'),'noindex, follow');
   await p.waitForURL(origin+'/',{timeout:20000}); // Original 15-second automatic return.
  }
  assert.deepEqual(errors,[]);console.log(JSON.stringify({viewport,metrics,errors,real404:true}));await c.close();
 }
 assert.equal((await fetch(origin+'/robots.txt')).status,200);
 assert.equal((await fetch(origin+'/__missing__.txt')).status,404);
 console.log('PASS: direct/deep 404, no-JS fallback, desktop/mobile original effects, client routing, manual and automatic home return.');
}finally{await browser.close();await new Promise(r=>server.close(r));}
