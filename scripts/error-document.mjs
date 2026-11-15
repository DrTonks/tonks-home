// Reuse the built application entry, styles and font declarations. Vue Router
// sees the original missing URL (Apache ErrorDocument is an internal redirect).
export function errorDocument(indexHtml){
 const head=indexHtml.match(/<head[^>]*>([\s\S]*?)<\/head>/i)?.[1];
 if(!head || !/<script[^>]*type="module"[^>]*src="\/assets\//.test(head))throw new Error('404 requires the built application entry');
 const errorHead=head
  .replace(/<title>[\s\S]*?<\/title>/gi,'<title>404 · 页面未找到 - DrTonks</title>')
  .replace(/<meta\b[^>]*(?:name="(?:description|robots|twitter:[^"]*)"|property="og:[^"]*")[^>]*>/gi,'')
  .replace(/<link\b[^>]*rel="(?:canonical|alternate|describedby)"[^>]*>/gi,'')
  .replace(/<script\b[^>]*type="application\/ld\+json"[^>]*>[\s\S]*?<\/script>/gi,'');
 return `<!doctype html><html lang="zh-CN"><head>${errorHead}
<meta name="robots" content="noindex, follow"><meta name="tonks-error-page" content="404">
<style>#static-not-found{position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#000;color:#fff;font:16px/1.7 system-ui,sans-serif}#static-not-found h1{font:900 clamp(100px,22vw,220px)/1.1 'JB-404',monospace;margin:0;text-shadow:0 0 40px #ffffff4d}#static-not-found p{color:#999;letter-spacing:.3em}#static-not-found a{color:#bbb}#static-not-found a:focus-visible{outline:2px solid #3399ff;outline-offset:5px}</style></head>
<body><div id="app"><main id="static-not-found"><h1>404</h1><p>Not Found</p><a href="/">回到首页</a><noscript><p>这个地址不存在或已移动。</p></noscript></main></div></body></html>`;
}
