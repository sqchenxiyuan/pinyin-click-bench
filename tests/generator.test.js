import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const root = new URL('../', import.meta.url).pathname;
test('generator parses weighted Rime rows, rejects invalid spellings and deduplicates deterministically', () => {
  const temp = mkdtempSync(join(tmpdir(), 'rime-test-'));
  try {
    mkdirSync(join(temp, 'cn_dicts'));
    const files = {
      '8105': '---\nname: 8105\n...\n你\tni\t1000\n泥\tni\t900\n界\tjie\t700\n',
      base: '---\nname: base\n...\n你好\tni hao\t5000\n世界\tshi jie\t4500\n你好\tni hao\t300\nA字\ta zi\t900\n',
      ext: '---\nname: ext\n...\n你好\tni hao\t100\n世·界\tshi jie\t100\n纸\tzhi\t100\n',
    };
    for (const [name, value] of Object.entries(files)) writeFileSync(join(temp, 'cn_dicts', `${name}.dict.yaml`), value);
    const output = join(temp, 'lexicon.js');
    const run = () => execFileSync('python3', ['scripts/generate-rime-ice.py', '--input-dir', join(temp, 'cn_dicts'), '--output', output, '--fixture'], { cwd: root, encoding: 'utf8' });
    run();
    const first = readFileSync(output, 'utf8');
    run();
    assert.equal(readFileSync(output, 'utf8'), first);
    assert.match(first, /"nihao":"你好:5000"/);
    assert.doesNotMatch(first, /A字|世·界/);
    assert.throws(() => execFileSync('python3', ['scripts/generate-rime-ice.py', '--input-dir', join(temp, 'cn_dicts'), '--output', output], { cwd: root, stdio: 'pipe' }), /sha256|SHA-256|hash/i);
  } finally { rmSync(temp, { recursive: true, force: true }); }
});
