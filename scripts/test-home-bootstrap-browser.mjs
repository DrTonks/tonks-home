import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile, stat} from 'node:fs/promises';
import {resolve, extname, sep} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const root=fileURLToPath(new URL('../dist/', import.meta.url));
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href);
// Production HTML/bundles, including Apache-style internal 404 fallback.
const server=createServer(async(req,res)=>{
 try {
  const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  const file=resolve(root,'.'+(path==='/'?'/index.html':path));
  if(!file.startsWith(resolve(root)+sep))throw new Error('Invalid path');
  let bytes,status=200,type;
  try {
   if(!(await stat(file)).isFile())throw new Error('Missing file');
   bytes=await readFile(file);
   type=({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.woff2':'font/woff2','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp'})[extname(file)]||'application/octet-stream';
  }catch{bytes=await readFile(resolve(root,'404.html'));status=404;type='text/html';}
  res.writeHead(status,{'Content-Type':type,'Cache-Control':'no-store'});res.end(bytes);
 }catch{res.writeHead(400);res.end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({channel:'msedge',headless:true});
const reports=[];
const shotDir=process.env.BOOT_SCREENSHOT_DIR;
async function setup(options={},scripts='allow'){
 const c=await browser.newContext(options);
 let release;
 const gate=new Promise(r=>{release=r;});
 await c.route('**/*',async r=>{
  const u=new URL(r.request().url());
  if(u.origin!==origin||u.pathname.startsWith('/api/'))return r.abort();
  if(u.pathname.endsWith('.js')){
   if(scripts==='block')return r.abort();
   if(scripts==='hold')await gate;
  }
  return r.continue();
 });
 return {c,release};
}
try{
 for(const dark of [false,true]){
  const {c,release}=await setup({viewport:dark?{width:390,height:844}:{width:1280,height:800},colorScheme:dark?'dark':'light'},'hold');
  await c.addInitScript(()=>{
   window.__profilePainted=false;
   function sample(){
    const el=document.getElementById('static-profile');
    if(el&&getComputedStyle(el).display!=='none'&&el.getBoundingClientRect().height>0)window.__profilePainted=true;
    if(!document.querySelector('.ld-hex'))requestAnimationFrame(sample);
   }
   requestAnimationFrame(sample);
  });
  const p=await c.newPage();await p.goto(origin,{waitUntil:'commit'});
  await p.locator('#static-profile').waitFor({state:'attached'});
  assert.equal(await p.locator('#static-profile').isVisible(),false);
  await p.waitForTimeout(1600);
  assert.equal(await p.locator('#static-profile').isVisible(),false);
  const beforeBg=await p.locator('body').evaluate(el=>getComputedStyle(el).backgroundColor);
  if(shotDir)await p.screenshot({path:resolve(shotDir,`boot-pending-${dark?'dark-mobile':'light-desktop'}.png`)});
  release();
  await p.locator('.ld-hex').first().waitFor({state:'attached'});
  assert.equal(await p.evaluate(()=>window.__profilePainted),false,'Static profile flashed before loading animation');
  assert.equal(await p.locator('#static-profile').count(),0);
  assert.equal(await p.locator('html').getAttribute('data-home-boot'),null);
  const loaderBg=await p.locator('.ld-hex').first().evaluate(el=>getComputedStyle(el.closest('svg').parentElement).backgroundColor);
  assert.equal(beforeBg,loaderBg,'Boot background must match the original loading screen');
  if(shotDir)await p.screenshot({path:resolve(shotDir,`boot-animation-${dark?'dark-mobile':'light-desktop'}.png`)});
  await p.locator('.ld-hex').first().waitFor({state:'detached',timeout:30000});
  reports.push({scenario:dark?'dark mobile':'light desktop',profileFlash:false,originalAnimation:true,matchingBackground:true});await c.close();
 }
 const nojs=await setup({javaScriptEnabled:false});const np=await nojs.c.newPage();await np.goto(origin,{waitUntil:'domcontentloaded'});
 assert.equal(await np.locator('#static-profile').isVisible(),true);assert.equal(await np.locator('#static-profile nav a').count(),5);
 reports.push({scenario:'no JavaScript',readableProfile:true});await nojs.c.close();
 const failed=await setup({},'block');const fp=await failed.c.newPage();await fp.goto(origin,{waitUntil:'domcontentloaded'});
 await fp.locator('#static-profile').waitFor({state:'visible',timeout:3000});
 assert.equal(await fp.locator('html').getAttribute('data-home-boot'),null);
 reports.push({scenario:'module download failed',readableProfile:true});await failed.c.close();
 const stalled=await setup({},'hold');const sp=await stalled.c.newPage();await sp.goto(origin,{waitUntil:'commit'});
 await sp.locator('#static-profile').waitFor({state:'attached'});assert.equal(await sp.locator('#static-profile').isVisible(),false);
 await sp.locator('#static-profile').waitFor({state:'visible',timeout:11000});
 stalled.release();await sp.locator('.ld-hex').first().waitFor({state:'attached'});assert.equal(await sp.locator('#static-profile').count(),0);
 reports.push({scenario:'startup timeout then recovery',readableFallback:true,lateStartupWorks:true});await stalled.c.close();
 const missing=await setup();const mp=await missing.c.newPage();assert.equal((await mp.goto(origin+'/missing-page',{waitUntil:'domcontentloaded'})).status(),404);
 await mp.locator('.glitch-main').waitFor({state:'visible'});assert.equal(await mp.locator('#home-bootstrap').count(),0);assert.equal(await mp.locator('.ld-hex').count(),0);
 reports.push({scenario:'404',originalErrorPage:true,noHomeAnimation:true});await missing.c.close();
 console.log(JSON.stringify(reports,null,2));
}finally{await browser.close();await new Promise(r=>server.close(r));}
