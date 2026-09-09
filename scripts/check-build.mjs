import { fileURLToPath } from 'node:url';
import { createPlan } from './deploy-plan.mjs';
const plan = createPlan(fileURLToPath(new URL('../dist', import.meta.url)));
console.log(`Artifact check passed: ${plan.assets.length} resources, ${plan.html.length} HTML; local entry CSS and literal resource references exist.`);
