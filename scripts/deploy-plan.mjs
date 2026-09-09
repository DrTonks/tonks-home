import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';

export const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');

export function resolveConfig(file = {}, env = process.env) {
  const pick = (key, field, fallback) => env[key] ?? file[field] ?? fallback;
  const provider = pick('DEPLOY_PROVIDER', 'provider', 'sftp');
  if (provider !== 'sftp') throw new Error('Only SFTP deployment is supported');
  const remoteDir = pick('DEPLOY_REMOTE_DIR', 'remoteDir', '/var/www/html');
  if (typeof remoteDir !== 'string' || !/^\/(?:[A-Za-z0-9_-]+\/){2,}[A-Za-z0-9_-]+$/.test(remoteDir)
      || path.posix.normalize(remoteDir) !== remoteDir) {
    throw new Error('Remote directory must be a canonical absolute site path (e.g. /var/www/html)');
  }
  const port = Number(pick('SSH_PORT', 'port', 22));
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid SSH port');
  // Explicit environment authentication replaces file authentication as a pair.
  const envAuth = env.DEPLOY_PASS !== undefined || env.DEPLOY_KEY_FILE !== undefined;
  const config = {
    remoteDir, port,
    host: pick('DEPLOY_HOST', 'host'), username: pick('DEPLOY_USER', 'user', 'root'),
    password: envAuth ? env.DEPLOY_PASS : file.password,
    keyFile: envAuth ? env.DEPLOY_KEY_FILE : file.keyFile,
  };
  if (!config.host || !config.username || (!config.password && !config.keyFile)) throw new Error('Missing SFTP credentials');
  // cleanRemote is deliberately ignored: there is no active-directory deletion path.
  return config;
}

export function createPlan(root) {
  root = path.resolve(root);
  const files = [];
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === '.DS_Store') continue;
      const full = path.join(dir, entry.name);
      if (entry.isSymbolicLink()) throw new Error(`Symlink not allowed: ${full}`);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile()) {
        const bytes = fs.readFileSync(full);
        files.push({ name: path.relative(root, full).split(path.sep).join('/'), bytes, hash: digest(bytes) });
      } else throw new Error(`Unsupported artifact: ${full}`);
    }
  }
  if (fs.lstatSync(root).isSymbolicLink()) throw new Error('Artifact root cannot be a symlink');
  walk(root);
  const byName = new Map(files.map(f => [f.name, f]));
  const requireFile = (name) => {
    const file = byName.get(name);
    if (!file || !file.bytes.length) throw new Error(`Missing or empty artifact: ${name}`);
    return file;
  };
  requireFile('index.html');
  function reference(value, owner) {
    if (/^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(value)) return null;
    const decoded = decodeURIComponent(value.split(/[?#]/)[0]);
    if (!decoded || decoded.startsWith('#')) return null;
    if (decoded.includes('\\') || decoded.includes('\0')) throw new Error(`Invalid reference in ${owner}`);
    const name = path.posix.normalize(decoded.startsWith('/') ? decoded.slice(1) : path.posix.join(path.posix.dirname(owner), decoded));
    if (name === '..' || name.startsWith('../')) throw new Error(`Reference escapes dist: ${value}`);
    requireFile(name);
    return name;
  }
  let entryCss = false;
  let entryScript = false;
  for (const file of files) {
    const source = file.bytes.toString('utf8');
    if (/\.html$/i.test(file.name)) {
      // Resource tags only: navigational links and API URLs are not dist files.
      for (const tag of source.matchAll(/<(?:script|link|img|source|video|audio)\b[^>]*>/gi)) {
        for (const attr of tag[0].matchAll(/\b(?:src|href|poster)\s*=\s*["']([^"']+)["']/gi)) {
          const name = reference(attr[1], file.name);
          if (file.name === 'index.html' && /\brel\s*=\s*["']stylesheet["']/i.test(tag[0]) && name?.endsWith('.css')) entryCss = true;
          if (file.name === 'index.html' && /^<script\b/i.test(tag[0]) && name?.endsWith('.js')) entryScript = true;
        }
      }
    }
    if (/\.(?:css|html)$/i.test(file.name)) {
      for (const url of source.matchAll(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^\s)]+))\s*\)/gi)) reference(url[1] ?? url[2] ?? url[3], file.name);
      for (const imp of source.matchAll(/@import\s+["']([^"']+)["']/gi)) reference(imp[1], file.name);
    }
    if (/\.js$/i.test(file.name)) {
      for (const imp of source.matchAll(/(?:\bfrom\s*|\bimport\s*(?:\(\s*)?)["']([^"']+)["']/g)) {
        if (/^(?:\.|\/)/.test(imp[1])) reference(imp[1], file.name);
      }
      // Vite's preload dependency map uses string paths rather than import syntax.
      for (const dep of source.matchAll(/["']((?:\.\/|\/)?assets\/[^"']+\.(?:js|css))["']/g)) reference('/' + dep[1].replace(/^(?:\.\/|\/)/, ''), file.name);
    }
  }
  if (!entryCss) throw new Error('index.html must reference a nonempty local stylesheet');
  if (!entryScript) throw new Error('index.html must reference a nonempty local entry script');
  const html = files.filter(f => /\.html$/i.test(f.name)).sort((a, b) => (a.name === 'index.html') - (b.name === 'index.html') || a.name.localeCompare(b.name));
  return { assets: files.filter(f => !/\.html$/i.test(f.name)), html };
}

export async function publishPlan(sftp, plan, remoteDir) {
  const id = randomUUID();
  const directories = new Map();
  function ensureDirectory(dir) {
    if (!directories.has(dir)) {
      directories.set(dir, (async () => {
        if (dir !== remoteDir) await ensureDirectory(path.posix.dirname(dir));
        await sftp.mkdir(dir, true);
      })());
    }
    return directories.get(dir);
  }
  async function stage(file) {
    const target = path.posix.join(remoteDir, file.name);
    const temporary = `${target}.upload-${id}`;
    await ensureDirectory(path.posix.dirname(target));
    await sftp.put(file.bytes, temporary);
    const remote = await sftp.get(temporary);
    if (!Buffer.isBuffer(remote) || digest(remote) !== file.hash) throw new Error(`Remote verification failed: ${file.name}`);
    return { temporary, target };
  }
  let nextAsset = 0;
  let failed = false;
  async function worker() {
    while (!failed && nextAsset < plan.assets.length) {
      const file = plan.assets[nextAsset++];
      try {
        const staged = await stage(file);
        await sftp.posixRename(staged.temporary, staged.target);
      } catch (error) {
        failed = true;
        throw error;
      }
    }
  }
  // Drain in-flight resources before returning an error (and closing SFTP).
  // No worker starts another resource after observing a failure.
  const results = await Promise.allSettled(
    Array.from({ length: Math.min(4, plan.assets.length) }, () => worker()),
  );
  const failure = results.find(result => result.status === 'rejected');
  if (failure) throw failure.reason;
  // Verify every HTML temporary file before replacing any live HTML.
  const pages = [];
  for (const file of plan.html) pages.push(await stage(file));
  for (const page of pages) await sftp.posixRename(page.temporary, page.target);
  // No unlink/rmdir, including on failure. A failed release keeps old hash assets.
}
