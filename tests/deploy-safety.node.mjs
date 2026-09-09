import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createPlan, publishPlan, resolveConfig } from '../scripts/deploy-plan.mjs';

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'home-deploy-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'assets'));
  fs.writeFileSync(path.join(root, 'index.html'), '<link rel="stylesheet" href="/assets/main.css"><script type="module" src="/assets/main.js"></script>');
  fs.writeFileSync(path.join(root, 'assets/main.css'), 'body{color:red}');
  fs.writeFileSync(path.join(root, 'assets/main.js'), 'import "./lazy.js"');
  fs.writeFileSync(path.join(root, 'assets/lazy.js'), 'export default 1');
  return root;
}
function fake(fail = () => {}) {
  const files = new Map([['/var/www/html/index.html', Buffer.from('old entry')], ['/var/www/html/assets/old-hash.js', Buffer.from('old chunk')]]);
  const events = [];
  return { files, events,
    async mkdir() {},
    async put(bytes, name) { events.push(['put', name]); fail('put', name); files.set(name, Buffer.from(bytes)); },
    async get(name) { events.push(['get', name]); fail('get', name); return files.get(name); },
    async posixRename(from, to) { events.push(['rename', to]); fail('rename', to); files.set(to, files.get(from)); files.delete(from); },
  };
}
const cfg = { host: 'file-host', user: 'file-user', password: 'file-password', remoteDir: '/var/www/html', cleanRemote: true };
test('environment wins, including explicit password over file key; cleaning has no option', () => {
  const c = resolveConfig({ ...cfg, keyFile: 'old-key' }, { DEPLOY_HOST: 'env-host', DEPLOY_USER: 'env-user', DEPLOY_PASS: 'env-pass', DEPLOY_REMOTE_DIR: '/var/www/home', SSH_PORT: '2222' });
  assert.equal(c.host, 'env-host'); assert.equal(c.username, 'env-user'); assert.equal(c.password, 'env-pass'); assert.equal(c.keyFile, undefined); assert.equal(c.remoteDir, '/var/www/home'); assert.equal(c.port, 2222); assert.equal(c.cleanRemote, undefined);
});
test('reject non-SFTP, unsafe directory and bad port', () => {
  assert.throws(() => resolveConfig(cfg, { DEPLOY_PROVIDER: 's3' }), /Only SFTP/);
  for (const dir of ['/', '/var', '/var/www', '/var/www/../html', '/var//www/html', '/var/www/html/', 'C:\\www', '/var/www/html\n']) assert.throws(() => resolveConfig(cfg, { DEPLOY_REMOTE_DIR: dir }), /directory/);
  assert.throws(() => resolveConfig(cfg, { SSH_PORT: '0' }), /port/);
});
for (const file of ['index.html', 'assets/main.css', 'assets/main.js', 'assets/lazy.js']) test(`reject missing ${file}`, t => {
  const root = fixture(t); fs.unlinkSync(path.join(root, file)); assert.throws(() => createPlan(root), /Missing/);
});
test('reject empty CSS and absent entry stylesheet', t => {
  const root = fixture(t); fs.writeFileSync(path.join(root, 'assets/main.css'), ''); assert.throws(() => createPlan(root), /empty/);
  fs.writeFileSync(path.join(root, 'index.html'), '<script src="/assets/main.js"></script>'); assert.throws(() => createPlan(root), /stylesheet/);
});
test('CSS imports, URLs and Vite preload references must resolve', t => {
  const root = fixture(t);
  for (const css of ['@import "./missing.css";', 'a{background:url("./missing.png")}']) { fs.writeFileSync(path.join(root, 'assets/main.css'), css); assert.throws(() => createPlan(root), /Missing/); }
  fs.writeFileSync(path.join(root, 'assets/main.css'), 'a{}'); fs.writeFileSync(path.join(root, 'assets/main.js'), 'const deps=["assets/missing.js"]'); assert.throws(() => createPlan(root), /Missing/);
});
test('data URLs and external fonts are not local paths; traversal rejected', t => {
  const root = fixture(t); fs.writeFileSync(path.join(root, 'assets/main.css'), 'a{background:url("data:image/svg+xml,%3Csvg filter=\'url(%23gn)\'%3E")} @import "https://example.test/font.css";');
  assert.equal(createPlan(root).html.length, 1);
  fs.writeFileSync(path.join(root, 'assets/main.css'), 'a{background:url("../../outside.png")}'); assert.throws(() => createPlan(root), /escapes/);
});
test('success verifies resources before HTML and retains old hashes', async t => {
  const sftp = fake(); await publishPlan(sftp, createPlan(fixture(t)), '/var/www/html');
  assert.equal(sftp.files.get('/var/www/html/assets/old-hash.js').toString(), 'old chunk');
  assert.match(sftp.files.get('/var/www/html/index.html').toString(), /stylesheet/);
  const firstHtml = sftp.events.findIndex(([op, p]) => op === 'put' && p.includes('index.html'));
  const renamedAsset = sftp.events.findIndex(([op, p]) => op === 'rename' && p === '/var/www/html/assets/main.js');
  assert.ok(renamedAsset >= 0 && renamedAsset < firstHtml);
  assert.deepEqual(sftp.events.at(-1), ['rename', '/var/www/html/index.html']);
});
for (const phase of ['put', 'get', 'rename']) test(`resource ${phase} interruption never publishes HTML`, async t => {
  const sftp = fake((op, name) => { if (op === phase && name.includes('/assets/')) throw new Error('interrupted'); });
  await assert.rejects(publishPlan(sftp, createPlan(fixture(t)), '/var/www/html'), /interrupted/);
  assert.equal(sftp.files.get('/var/www/html/index.html').toString(), 'old entry');
  assert.ok(!sftp.events.some(([op, name]) => op === 'rename' && name.endsWith('.html')));
});
test('hash mismatch prevents entry publication', async t => {
  const sftp = fake(); sftp.get = async () => Buffer.from('corrupt');
  await assert.rejects(publishPlan(sftp, createPlan(fixture(t)), '/var/www/html'), /verification/);
  assert.equal(sftp.files.get('/var/www/html/index.html').toString(), 'old entry');
});
test('HTML staging interruption leaves all live HTML unchanged', async t => {
  const root = fixture(t); fs.writeFileSync(path.join(root, 'about.html'), 'about');
  const sftp = fake((op, name) => { if (op === 'put' && name.includes('index.html')) throw new Error('interrupted'); });
  await assert.rejects(publishPlan(sftp, createPlan(root), '/var/www/html'), /interrupted/);
  assert.ok(!sftp.events.some(([op, name]) => op === 'rename' && name.endsWith('.html')));
});
test('unsupported posixRename fails closed without deletion fallback', async t => {
  const sftp = fake(); sftp.posixRename = async () => { throw new Error('unsupported'); };
  await assert.rejects(publishPlan(sftp, createPlan(fixture(t)), '/var/www/html'), /unsupported/);
  assert.equal(sftp.files.get('/var/www/html/index.html').toString(), 'old entry');
});

test('entry must include a local JavaScript entry, not just CSS', t => {
  const root = fixture(t); fs.writeFileSync(path.join(root, 'index.html'), '<link rel="stylesheet" href="/assets/main.css">');
  assert.throws(() => createPlan(root), /entry script/);
});
test('each resource is downloaded exactly once, from its temporary path', async t => {
  const sftp = fake(); const plan = createPlan(fixture(t));
  await publishPlan(sftp, plan, '/var/www/html');
  const downloads = sftp.events.filter(([op]) => op === 'get');
  assert.equal(downloads.length, plan.assets.length + plan.html.length);
  for (const file of [...plan.assets, ...plan.html]) {
    assert.equal(downloads.filter(([, name]) => name.startsWith(`/var/www/html/${file.name}.upload-`)).length, 1);
  }
});
test('corrupt HTML temporary file cannot replace the live entry', async t => {
  const sftp = fake(); const get = sftp.get;
  sftp.get = async name => name.includes('index.html.upload-') ? Buffer.from('corrupt HTML') : get(name);
  await assert.rejects(publishPlan(sftp, createPlan(fixture(t)), '/var/www/html'), /Remote verification/);
  assert.equal(sftp.files.get('/var/www/html/index.html').toString(), 'old entry');
});

function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}
const turn = () => new Promise(resolve => setImmediate(resolve));
function manyAssets(t) {
  const root = fixture(t);
  for (let i = 0; i < 6; i++) fs.writeFileSync(path.join(root, `assets/extra-${i}.js`), `export default ${i}`);
  return createPlan(root);
}

test('four resources run concurrently and all renames finish before HTML staging', { timeout: 3000 }, async t => {
  const plan = manyAssets(t); const sftp = fake();
  const firstFour = deferred(); const releaseFirst = deferred(); const lastReached = deferred(); const releaseLast = deferred();
  let active = 0; let peak = 0; let started = 0; let completed = 0;
  const put = sftp.put; const rename = sftp.posixRename;
  sftp.put = async (bytes, name) => {
    if (name.includes('/assets/')) {
      active++; started++; peak = Math.max(peak, active);
      if (started === 4) firstFour.resolve();
    } else assert.equal(completed, plan.assets.length, 'HTML staging must wait for every resource rename');
    await put(bytes, name);
  };
  sftp.posixRename = async (from, to) => {
    if (to.includes('/assets/')) {
      await releaseFirst.promise;
      if (to.endsWith('/' + plan.assets.at(-1).name)) { lastReached.resolve(); await releaseLast.promise; }
      await rename(from, to); active--; completed++;
    } else await rename(from, to);
  };
  const publishing = publishPlan(sftp, plan, '/var/www/html');
  await firstFour.promise;
  assert.equal(active, 4); assert.equal(started, 4);
  releaseFirst.resolve(); await lastReached.promise; await turn();
  assert.ok(!sftp.events.some(([op, name]) => op === 'put' && name.includes('.html')));
  releaseLast.resolve(); await publishing;
  assert.equal(peak, 4); assert.equal(active, 0); assert.equal(completed, plan.assets.length);
});

for (const phase of ['put', 'get', 'posixRename']) test(`concurrent ${phase} failure drains peers, stops queue and never stages HTML`, { timeout: 3000 }, async t => {
  const plan = manyAssets(t); const sftp = fake(); const original = sftp[phase];
  const allStarted = deferred(); const failFirst = deferred(); const finishPeers = deferred();
  let reached = 0; let drained = 0; let settled = false;
  sftp[phase] = async (...args) => {
    const order = reached++;
    if (reached === 4) allStarted.resolve();
    if (order === 0) { await failFirst.promise; throw new Error('first resource failed'); }
    await finishPeers.promise;
    drained++;
    if (order === 1) throw new Error('second in-flight failure');
    return original(...args);
  };
  const publishing = publishPlan(sftp, plan, '/var/www/html');
  const outcome = publishing.then(() => { settled = true; return null; }, error => { settled = true; return error; });
  await allStarted.promise; failFirst.resolve(); await turn();
  assert.equal(settled, false, 'must wait for in-flight operations instead of rejecting early');
  assert.equal(reached, 4, 'no queued resource starts after failure');
  finishPeers.resolve(); const error = await outcome;
  assert.match(error.message, /resource failed|in-flight failure/);
  assert.equal(drained, 3); assert.equal(reached, 4);
  assert.ok(!sftp.events.some(([op, name]) => op === 'put' && name.includes('.html')));
  assert.equal(sftp.files.get('/var/www/html/index.html').toString(), 'old entry');
  const count = sftp.events.length; await turn();
  assert.equal(sftp.events.length, count, 'no operations continue after publication rejects');
});

test('concurrent resources share directory creation and wait for parent completion', async t => {
  const root = fixture(t);
  fs.mkdirSync(path.join(root, 'assets/nested'));
  fs.writeFileSync(path.join(root, 'assets/nested/extra.js'), 'export default 2');
  const sftp = fake(); const created = new Set(); const calls = [];
  sftp.mkdir = async dir => {
    assert.ok(!calls.includes(dir), 'directory creation must be shared');
    if (dir !== '/var/www/html') assert.ok(created.has(path.posix.dirname(dir)), 'parent must be ready');
    calls.push(dir); await turn(); created.add(dir);
  };
  await publishPlan(sftp, createPlan(root), '/var/www/html');
  assert.deepEqual(calls, ['/var/www/html', '/var/www/html/assets', '/var/www/html/assets/nested']);
});
test('shared directory failure rejects without uploads or HTML publication', async t => {
  const sftp = fake(); sftp.mkdir = async () => { throw new Error('mkdir failed'); };
  await assert.rejects(publishPlan(sftp, manyAssets(t), '/var/www/html'), /mkdir failed/);
  assert.equal(sftp.events.length, 0);
  assert.equal(sftp.files.get('/var/www/html/index.html').toString(), 'old entry');
});
