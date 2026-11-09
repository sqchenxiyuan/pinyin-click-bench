import test from 'node:test';
import assert from 'node:assert/strict';
import { startRound, dispatch, visibleCandidates, ROUNDS, DICTIONARY, syllableFor, scoreRound } from '../src/ime.js';

test('clicking a pinyin sequence and its candidate commits the matching character', () => {
  let game = startRound('easy', 1000);
  game = dispatch(game, { type: 'letter', value: 'n' }, 1100);
  game = dispatch(game, { type: 'letter', value: 'i' }, 1200);
  const index = visibleCandidates(game).items.indexOf('你');
  assert.ok(index >= 0, '你 is a visible ni candidate');
  game = dispatch(game, { type: 'candidate', index }, 1300);
  assert.equal(game.committed, '你');
  assert.equal(game.pinyin, '');
  assert.equal(game.actions, 3);
});

test('every Chinese character in every curated round can be reached by a pinyin candidate page', () => {
  for (const round of Object.values(ROUNDS)) {
    for (const character of [...round.target]) {
      if (!/\p{Script=Han}/u.test(character)) continue;
      const syllable = syllableFor(character);
      assert.ok(syllable, `missing pinyin for ${character}`);
      const choices = DICTIONARY[syllable];
      assert.ok(choices.includes(character), `missing candidate ${character} for ${syllable}`);
      assert.ok(new Set(choices).size === choices.length, `duplicate candidate for ${syllable}`);
    }
  }
});

test('a partial pinyin like s or sh shows shi candidates before the syllable is complete', () => {
  for (const prefix of ['s', 'sh']) {
    let game = startRound('easy', 0);
    for (const value of prefix) game = dispatch(game, { type: 'letter', value }, 100);
    const candidates = visibleCandidates(game);
    assert.ok(candidates.items.includes('是'), `${prefix} should suggest 是`);
    assert.ok(candidates.pages > 0, `${prefix} has a candidate page`);
    game = dispatch(game, { type: 'candidate', index: candidates.items.indexOf('是') }, 200);
    assert.equal(game.committed, '是');
    assert.equal(game.pinyin, '');
  }
});

test('a partial pinyin remains deterministic and never suggests unrelated syllables', () => {
  let game = dispatch(startRound('easy', 0), { type: 'letter', value: 'n' }, 100);
  assert.deepEqual(visibleCandidates(game).items, ['你', '尼', '泥', '拟', '逆']);
  game = dispatch(startRound('easy', 0), { type: 'letter', value: 's' }, 100);
  assert.ok(visibleCandidates(game).items.includes('是'));
  assert.ok(!visibleCandidates(game).items.includes('你'));
  game = dispatch(startRound('easy', 0), { type: 'letter', value: 'x' }, 100);
  game = dispatch(game, { type: 'letter', value: 'x' }, 100);
  assert.deepEqual(visibleCandidates(game), { items: [], page: 0, pages: 0 });
});

test('neng candidate list does not include characters pronounced geng or leng', () => {
  assert.deepEqual(DICTIONARY.neng, ['能']);
});

test('candidate pages are deterministic and selection uses only the visible page', () => {
  let game = startRound('easy', 0);
  for (const letter of 'ni') game = dispatch(game, { type: 'letter', value: letter }, 100);
  assert.deepEqual(visibleCandidates(game).items, ['你', '尼', '泥', '拟', '逆']);
  assert.equal(visibleCandidates(game).pages, 2);
  game = dispatch(game, { type: 'page', direction: 1 }, 200);
  assert.deepEqual(visibleCandidates(game).items, ['呢', '匿']);
  game = dispatch(game, { type: 'candidate', index: 0 }, 300);
  assert.equal(game.committed, '呢');
  assert.equal(game.actions, 4);
});

test('backspace edits pinyin first, then committed text, and a wrong candidate is correctable', () => {
  let game = startRound('easy', 0);
  for (const value of 'ni') game = dispatch(game, { type: 'letter', value }, 100);
  game = dispatch(game, { type: 'backspace' }, 200);
  assert.equal(game.pinyin, 'n');
  game = dispatch(game, { type: 'letter', value: 'i' }, 300);
  game = dispatch(game, { type: 'candidate', index: 1 }, 400);
  assert.equal(game.committed, '尼');
  game = dispatch(game, { type: 'backspace' }, 500);
  assert.equal(game.committed, '');
  assert.equal(game.actions, 6);
});

test('punctuation is clicked directly and full target finishes automatically', () => {
  let game = startRound('easy', 0);
  for (const character of [...ROUNDS.easy.target]) {
    if (/\p{Script=Han}/u.test(character)) {
      for (const value of syllableFor(character)) game = dispatch(game, { type: 'letter', value }, 100);
      let index = visibleCandidates(game).items.indexOf(character);
      while (index < 0) {
        game = dispatch(game, { type: 'page', direction: 1 }, 100);
        index = visibleCandidates(game).items.indexOf(character);
      }
      game = dispatch(game, { type: 'candidate', index }, 100);
    } else game = dispatch(game, { type: 'punctuation', value: character }, 100);
  }
  assert.equal(game.committed, ROUNDS.easy.target);
  assert.equal(game.endedAt, 100);
  assert.equal(scoreRound(game, 200).accuracy, 100);
});

test('invalid selections, invalid navigation, and physical-key actions do not change state', () => {
  const game = startRound('easy', 100);
  assert.equal(dispatch(game, { type: 'candidate', index: 0 }, 200), game);
  assert.equal(dispatch(game, { type: 'page', direction: 1 }, 200), game);
  assert.equal(dispatch(game, { type: 'letter', value: '你' }, 200), game);
  assert.equal(dispatch(game, { type: 'punctuation', value: 'x' }, 200), game);
  assert.equal(dispatch(game, { type: 'backspace' }, 200), game);
});

test('score uses positional accuracy, elapsed time and action cost', () => {
  const clean = { ...startRound('easy', 0), committed: '你好，世界！', actions: 12, endedAt: 10_000 };
  const slow = { ...clean, endedAt: 30_000 };
  const wasteful = { ...clean, actions: 25 };
  const incorrect = { ...clean, committed: '尼好，世界！' };
  assert.equal(scoreRound(clean, 100_000).accuracy, 100);
  assert.equal(scoreRound(clean, 100_000).elapsedMs, 10_000);
  assert.equal(scoreRound(incorrect, 100_000).correct, 5);
  assert.ok(scoreRound(clean).score > scoreRound(slow).score);
  assert.ok(scoreRound(clean).score > scoreRound(wasteful).score);
  assert.ok(scoreRound(clean).score > scoreRound(incorrect).score);
});

test('finish button locks a complete-length attempt even when characters differ', () => {
  let game = { ...startRound('easy', 0), committed: '尼好，世界！', actions: 15 };
  game = dispatch(game, { type: 'finish' }, 12000);
  assert.equal(game.endedAt, 12000);
  assert.equal(game.actions, 16);
  assert.equal(dispatch(game, { type: 'letter', value: 'n' }, 13000), game);
  assert.equal(scoreRound(game).accuracy, 83);
});

test('finish button cannot submit an incomplete attempt', () => {
  const game = startRound('easy', 0);
  assert.equal(dispatch(game, { type: 'finish' }, 100), game);
});

test('a full-length imperfect attempt cannot append extra characters but can edit', () => {
  const game = { ...startRound('easy', 0), committed: '尼好，世界！' };
  assert.equal(dispatch(game, { type: 'letter', value: 'n' }, 100), game);
  assert.equal(dispatch(game, { type: 'punctuation', value: '。' }, 100), game);
  assert.equal(dispatch(game, { type: 'backspace' }, 100).committed, '尼好，世界');
});

test('all curated rounds complete end-to-end through letters, pages, candidates and punctuation', () => {
  for (const level of Object.keys(ROUNDS)) {
    let game = startRound(level, 0);
    for (const character of [...ROUNDS[level].target]) {
      if (/\p{Script=Han}/u.test(character)) {
        for (const value of syllableFor(character)) game = dispatch(game, { type: 'letter', value }, 1000);
        while (!visibleCandidates(game).items.includes(character)) game = dispatch(game, { type: 'page', direction: 1 }, 1000);
        game = dispatch(game, { type: 'candidate', index: visibleCandidates(game).items.indexOf(character) }, 1000);
      } else game = dispatch(game, { type: 'punctuation', value: character }, 1000);
    }
    assert.equal(game.committed, ROUNDS[level].target);
    assert.equal(game.endedAt, 1000);
    assert.equal(scoreRound(game).accuracy, 100);
  }
});
