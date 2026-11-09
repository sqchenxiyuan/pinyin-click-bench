import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('../', import.meta.url).pathname;

test('static build copies complete app with subpath-safe relative asset references', () => {
  rmSync(join(root, 'dist'), { recursive: true, force: true });
  execFileSync(process.execPath, ['scripts/build.mjs'], { cwd: root });
  const html = readFileSync(join(root, 'dist/index.html'), 'utf8');
  const app = readFileSync(join(root, 'dist/src/app.js'), 'utf8');
  assert.match(app, /ziji-record-v2/);
  assert.match(app, /LEXICON_VERSION/);
  assert.doesNotMatch(app, /localStorage\.getItem\('ziji-record-v1'\)/);
  assert.match(html, /src="\.\/src\/app\.js"/);
  assert.match(html, /href="\.\/src\/style\.css"/);
  assert.ok(existsSync(join(root, 'dist/src/ime.js')));
  assert.ok(existsSync(join(root, 'dist/src/lexicon.js')));
  assert.ok(existsSync(join(root, 'dist/NOTICE.md')));
  assert.ok(existsSync(join(root, 'dist/src/app.js')));
  assert.ok(existsSync(join(root, 'dist/src/style.css')));
  assert.doesNotMatch(html, /(?:src|href)="\/(?!\/)/);
});
