import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {searchArtifacts,profile} from './search-artifacts.mjs';
import {errorDocument} from './error-document.mjs';
import {checkSearchHtml} from './search-html.mjs';
export function checkSearch(root=new URL('../dist/',import.meta.url)){
 for(const [name,expected] of searchArtifacts())assert.equal(readFileSync(new URL(name,root),'utf8'),expected,`Stale search artifact: ${name}`);
 const html=readFileSync(new URL('index.html',root),'utf8');
 checkSearchHtml(html,profile);
 assert.equal(readFileSync(new URL('404.html',root),'utf8'),errorDocument(html),'404 must reuse the current built application entry');
 assert.ok(readFileSync(new URL('.htaccess',root),'utf8').includes('FallbackResource disabled'));
 console.log('[search-check] Public HTML and six generated discovery artifacts verified.');
}
checkSearch();
