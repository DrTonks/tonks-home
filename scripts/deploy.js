import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import SftpClient from 'ssh2-sftp-client';
import { createPlan, publishPlan, resolveConfig } from './deploy-plan.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const configPath = [path.join(root, 'deploy.config.json'), path.join(root, 'scripts/deploy.config.json')].find(p => fs.existsSync(p));
const config = resolveConfig(configPath ? JSON.parse(fs.readFileSync(configPath, 'utf8')) : {});
const plan = createPlan(path.join(root, 'dist'));
const { remoteDir, keyFile, password, ...connection } = config;
const auth = keyFile ? { privateKey: fs.readFileSync(keyFile) } : { password };
console.log(`[deploy] SFTP ${connection.host}:${connection.port} -> ${remoteDir}; retain existing files; ${plan.assets.length} assets, ${plan.html.length} HTML`);
console.log('[deploy] Shared emoji directory and blog article index are separate release prerequisites.');
const sftp = new SftpClient();
try {
  await sftp.connect({ ...connection, ...auth, readyTimeout: 20000 });
  await publishPlan(sftp, plan, remoteDir);
  console.log('[deploy] Verified resources and published HTML.');
} catch (error) {
  console.error('[deploy] Failed:', error.message);
  process.exitCode = 1;
} finally {
  await sftp.end();
}
