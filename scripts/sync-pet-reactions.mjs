// The homepage config is authoritative; generated copies contain no image binaries.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const config = JSON.parse(fs.readFileSync(path.join(root, 'src/data/pet-reactions.json'), 'utf8'));
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'public/emojis/manifest.json'), 'utf8'));
const assets = new Map(manifest.groups.flatMap(g => g.items).map(i => [i.token, i]));
const seen = new Set();
const resolved = {};
const pets = new Set(['static', 'live2d']);
for (const item of config.items) {
  const asset = assets.get(item.token);
  if (!/^[a-z][a-z0-9_]{0,39}$/.test(item.id) || seen.has(item.id) || !item.description?.trim()
    || !item.pets.length || item.pets.some(p => !pets.has(p))
    || !asset?.src || !/^\/emojis\/v\d+\/[a-z0-9-]+\/[a-zA-Z0-9_-]+\.(png|jpg|jpeg|webp|gif)$/.test(asset.src)) {
    throw new Error(`Invalid pet reaction: ${item.id}`);
  }
  if (!fs.existsSync(path.join(root, 'public', asset.src))) throw new Error(`Missing image: ${item.id}`);
  if (item.legacySrc && !fs.existsSync(path.join(root, 'public', item.legacySrc))) throw new Error(`Missing legacy image: ${item.id}`);
  seen.add(item.id);
  resolved[item.id] = { src: asset.src, label: item.description };
}
const outputs = [
  [path.join(root, 'src/data/pet-reaction-assets.json'), resolved],
  [path.join(root, '../sleepy/pet_ai/reactions.json'), { schema: 1, items: config.items.map(({ id, description, pets }) => ({ id, description, pets })) }],
];
for (const [file, data] of outputs) {
  const expected = JSON.stringify(data, null, 2) + '\n';
  if (process.argv.includes('--check')) {
    if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== expected) throw new Error(`Run node scripts/sync-pet-reactions.mjs: ${file}`);
  } else fs.writeFileSync(file, expected);
}
console.log(`Pet reactions ${process.argv.includes('--check') ? 'verified' : 'synchronized'}: ${seen.size}`);
