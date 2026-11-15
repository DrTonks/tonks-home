import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
export const profile=JSON.parse(readFileSync(new URL('../src/config/public-profile.json',import.meta.url),'utf8'));
export const escapeHtml=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const json=s=>JSON.stringify(s).replace(/</g,'\\u003c');
export function searchArtifacts(){
 const markdown=`# ${profile.name}\n\n${profile.tagline}\n\n${profile.description}\n\n## 站点导航\n\n${profile.links.map(l=>`- [${l.title}](${l.url})：${l.description}`).join('\n')}\n`;
 const llms=`# ${profile.name} 的个人主页\n\n> ${profile.description}\n\n本站有可选的浏览器互动。公开信息无需登录；静态入口可直接读取。\n\n## 内容入口\n\n- [个人简介与站点导航](${profile.url}index.md)\n- [结构化站点目录](${profile.url}agent/site.json)\n- [博客内容入口](https://blog.tonks.top/llms.txt)\n\nWebMCP（支持时）：tonks_home_info、tonks_find_destinations，仅查询公开资料，不提供留言、投票或管理操作。\n`;
 const notFound='<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta name="robots" content="noindex"><title>页面未找到 - DrTonks</title><body><main><h1>页面未找到</h1><p>这个地址不存在或已移动。</p><a href="/">返回主页</a></main></body></html>';
 return new Map([
  ['robots.txt',`User-agent: *\nAllow: /\n\nSitemap: ${profile.url}sitemap.xml\n`],
  ['sitemap.xml',`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${escapeHtml(profile.url)}</loc></url></urlset>`],
  ['llms.txt',llms],['index.md',markdown],['404.html',notFound],
  ['agent/site.json',JSON.stringify({schemaVersion:1,...profile,markdown:profile.url+'index.md'})]
 ]);
}
export function searchHead(){return `<style>#static-profile{max-width:52rem;margin:8vh auto;padding:2rem;border:1px solid #c9deee;border-radius:1.25rem;background:#fff;color:#263b50;font:18px/1.8 system-ui,sans-serif;box-shadow:0 12px 40px #315b7910}#static-profile h1{font-size:2rem;font-weight:700;margin:0 0 .5rem}#static-profile p{margin:.75rem 0}#static-profile ul{list-style:disc;padding-left:1.4rem}#static-profile li{margin:.5rem 0}#static-profile a{color:#17669c;text-decoration:underline;text-underline-offset:3px}#static-profile a:focus-visible{outline:2px solid currentColor;outline-offset:3px}@media(max-width:640px){#static-profile{margin:1rem;padding:1.25rem;font-size:16px}}</style><link rel="canonical" href="${escapeHtml(profile.url)}"><link rel="describedby" type="text/plain" href="/llms.txt"><link rel="alternate" type="text/markdown" href="/index.md"><meta property="og:type" content="website"><meta property="og:title" content="${escapeHtml(profile.name)} 的个人主页"><meta property="og:description" content="${escapeHtml(profile.description)}"><meta property="og:url" content="${escapeHtml(profile.url)}"><meta property="og:image" content="${escapeHtml(profile.image)}"><meta name="twitter:card" content="summary_large_image"><script type="application/ld+json" id="site-identity">${json({'@context':'https://schema.org','@graph':[{'@type':'Person','@id':profile.url+'#person',name:profile.name,url:profile.url,image:profile.image,sameAs:profile.sameAs},{'@type':'WebSite','@id':profile.url+'#website',url:profile.url,name:profile.name,description:profile.description,inLanguage:'zh-CN',author:{'@id':profile.url+'#person'}}]})}</script>`;}
export function searchBody(){return `<main id="static-profile"><h1>${escapeHtml(profile.name)}</h1><p>${escapeHtml(profile.tagline)}</p><p>${escapeHtml(profile.description)}</p><nav aria-label="站点导航"><ul>${profile.links.map(l=>`<li><a href="${escapeHtml(l.url)}">${escapeHtml(l.title)}</a>：${escapeHtml(l.description)}</li>`).join('')}</ul></nav><noscript><p>当前为静态阅读模式。启用 JavaScript 后可使用互动主页；以上内容入口仍可正常访问。</p></noscript></main>`;}
export default function searchPlugin(){
 const artifacts=searchArtifacts();
 const mime=p=>p.endsWith('.json')?'application/json':p.endsWith('.xml')?'application/xml':p.endsWith('.md')?'text/markdown':p.endsWith('.html')?'text/html':'text/plain';
 const middleware=(req,res,next)=>{
  const path=new URL(req.url,'http://localhost').pathname.slice(1);
  if(!artifacts.has(path))return next();
  res.setHeader('Content-Type',mime(path)+'; charset=utf-8');res.setHeader('Cache-Control','no-cache');res.end(artifacts.get(path));
 };
 return {name:'tonks-search-artifacts',
  transformIndexHtml(html){return html.replace('<!-- public-search-head -->',searchHead()).replace('<!-- public-search-body -->',searchBody()).replace('<meta name="description" content="Tonks 的主页" />',`<meta name="description" content="${escapeHtml(profile.description)}" />`);},
  configureServer(server){
    server.middlewares.use(middleware);
    const profileFile=fileURLToPath(new URL('../src/config/public-profile.json',import.meta.url));
    const changed=file=>{if(file===profileFile)void server.restart();};
    server.watcher.add(profileFile);server.watcher.on('change',changed);
    server.httpServer?.once('close',()=>server.watcher.off('change',changed));
  },
  generateBundle(){for(const [fileName,source] of artifacts)this.emitFile({type:'asset',fileName,source});}
 };
}
