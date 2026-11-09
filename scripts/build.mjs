import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const dist = join(root, 'dist');
rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });
cpSync(join(root, 'index.html'), join(dist, 'index.html'));
cpSync(join(root, 'NOTICE.md'), join(dist, 'NOTICE.md'));
cpSync(join(root, 'LICENSE'), join(dist, 'LICENSE'));
cpSync(join(root, 'scripts/generate-rime-ice.py'), join(dist, 'scripts/generate-rime-ice.py'));
cpSync(join(root, 'src'), join(dist, 'src'), { recursive: true });
console.log('Built static site in dist/');
