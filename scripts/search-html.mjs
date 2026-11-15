import assert from 'node:assert/strict';
import {escapeHtml} from './search-artifacts.mjs';

export function checkSearchHtml(html, profile){
 assert.ok(html.includes('id="static-profile"'));
 assert.ok(html.includes(escapeHtml(profile.description)), 'Missing public description');
 assert.ok(html.includes('application/ld+json'));assert.ok(html.includes('rel="canonical"'));
 assert.ok(!html.includes('<!-- public-search-'));
 for(const link of profile.links)assert.ok(html.includes(`href="${escapeHtml(link.url)}"`), `Missing public destination: ${link.url}`);
}
