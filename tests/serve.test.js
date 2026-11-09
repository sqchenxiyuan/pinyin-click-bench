import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';

test('preview serves the app at its GitHub Pages subpath and rejects traversal', async () => {
  const child = spawn(process.execPath, ['scripts/serve.mjs'], {
    cwd: new URL('../', import.meta.url).pathname,
    env: { ...process.env, PORT: '4179' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  try {
    await Promise.race([
      once(child.stdout, 'data'),
      new Promise((_, reject) => setTimeout(() => reject(new Error('server startup timeout')), 3000)),
    ]);
    const response = await fetch('http://127.0.0.1:4179/pinyin-click-bench/');
    assert.equal(response.status, 200);
    assert.match(await response.text(), /字击 · Pinyin Click Bench/);
    const js = await fetch('http://127.0.0.1:4179/pinyin-click-bench/src/app.js');
    assert.equal(js.status, 200);
    assert.match(await js.text(), /startRound/);
    const forbidden = await fetch('http://127.0.0.1:4179/pinyin-click-bench/%2e%2e/%2e%2e/etc/passwd');
    assert.equal(forbidden.status, 404);
  } finally {
    child.kill();
    await once(child, 'exit');
  }
});
