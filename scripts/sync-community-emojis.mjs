// Run after updating the shared module or emoji assets. Does not deploy.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root = fileURLToPath(new URL('../',import.meta.url));
const blog = path.resolve(root,'../blogExample');
for (const file of ['community-emojis.ts','community-markdown.ts','community-markdown.css','community-articles.ts','community-articles.css','community-overlay.ts']) {
  await fs.copyFile(path.join(root,'src/lib',file),path.join(blog,'src/utils',file));
}
await fs.cp(path.join(root,'public/emojis'),path.join(blog,'public/emojis'),{recursive:true});
console.log('Shared emoji module and assets synchronized.');
