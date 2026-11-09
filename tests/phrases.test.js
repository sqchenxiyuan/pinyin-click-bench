import test from 'node:test';
import assert from 'node:assert/strict';
import { startRound, dispatch, visibleCandidates, ROUNDS, syllableFor, scoreRound, LEXICON_VERSION } from '../src/ime.js';
import { PACKED_LEXICON } from '../src/lexicon.js';

function enter(game, pinyin, word, now = 100) {
  for (const value of pinyin) game = dispatch(game, { type: 'letter', value }, now);
  let candidates = visibleCandidates(game);
  while (!candidates.items.includes(word)) {
    assert.ok(candidates.pages > game.page + 1, `${word} missing from ${pinyin}`);
    game = dispatch(game, { type: 'page', direction: 1 }, now);
    candidates = visibleCandidates(game);
  }
  return dispatch(game, { type: 'candidate', index: candidates.items.indexOf(word) }, now);
}

test('index covers many genuine Rime keys with numeric weights and no bundled legacy corpus', () => {
  assert.ok(Object.keys(PACKED_LEXICON).length > 150000);
  assert.match(PACKED_LEXICON.nihao, /你好:\d+/);
  assert.match(PACKED_LEXICON.shijie, /世界:\d+/);
  assert.ok(PACKED_LEXICON.shi.split(' ').length > 50);
  assert.ok(!Object.keys(PACKED_LEXICON).some(key => key.includes(' ')));
});

test('prefix top 250 matches exhaustive weighted ranking even after heap reaches capacity', () => {
  const prefix = 's';
  const exact = (PACKED_LEXICON[prefix] || '').split(' ').filter(Boolean).map(record => ({ word: record.slice(0, record.lastIndexOf(':')), weight: Number(record.slice(record.lastIndexOf(':') + 1)) }));
  const completions = Object.entries(PACKED_LEXICON).filter(([key]) => key.startsWith(prefix) && key !== prefix)
    .flatMap(([, raw]) => raw.split(' ').map(record => ({ word: record.slice(0, record.lastIndexOf(':')), weight: Number(record.slice(record.lastIndexOf(':') + 1)) })));
  const compare = (a, b) => b.weight - a.weight || (a.word < b.word ? -1 : a.word > b.word ? 1 : 0);
  const unique = new Set();
  const expected = [...exact.sort(compare), ...completions.sort(compare)].filter(entry => {
    if (unique.has(entry.word)) return false;
    unique.add(entry.word);
    return true;
  }).slice(0, 250).map(entry => entry.word);
  let game = startRound('hard');
  game = dispatch(game, { type: 'letter', value: prefix });
  const observed = [];
  while (true) {
    observed.push(...visibleCandidates(game).items);
    if (game.page + 1 >= visibleCandidates(game).pages) break;
    game = dispatch(game, { type: 'page', direction: 1 });
  }
  assert.deepEqual(observed, expected.filter(word => [...word].length <= [...ROUNDS.hard.target].length));
});


test('exact candidates rank before prefix completions and numeric frequency breaks ties', () => {
  let game = startRound('easy');
  for (const value of 'ni') game = dispatch(game, { type: 'letter', value });
  const words = [];
  while (true) {
    words.push(...visibleCandidates(game).items);
    if (game.page + 1 >= visibleCandidates(game).pages) break;
    game = dispatch(game, { type: 'page', direction: 1 });
  }
  assert.equal(words[0], '你');
  assert.ok(words.indexOf('泥') >= 0 && words.indexOf('泥') < words.indexOf('你好'));
  assert.equal(new Set(words).size, words.length);
});


test('licensed broad index offers whole phrases and nontrivial homophones', () => {
  assert.match(LEXICON_VERSION, /^rime-ice\/99662ba01e3affa6a0f009174ca530b887bac3b6\//);
  for (const [pinyin, word] of [['nihao', '你好'], ['shijie', '世界']]) {
    let game = startRound();
    for (const value of pinyin) game = dispatch(game, { type: 'letter', value }, 100);
    assert.ok(visibleCandidates(game).items.includes(word), `${word} should appear for ${pinyin}`);
  }
  for (const pinyin of ['shi', 'ni', 'yu']) {
    let game = startRound();
    for (const value of pinyin) game = dispatch(game, { type: 'letter', value }, 100);
    assert.ok(visibleCandidates(game).pages >= 5, `${pinyin} must have many homophones`);
    game = dispatch(game, { type: 'page', direction: 1 }, 100);
    assert.equal(visibleCandidates(game).page, 1);
  }
});

test('partial prefixes are ranked, bounded and dynamic without target leakage', () => {
  for (const prefix of ['s', 'sh', 'shi', 'shij', 'shijie']) {
    let game = startRound('medium');
    for (const value of prefix) game = dispatch(game, { type: 'letter', value }, 1);
    assert.ok(visibleCandidates(game).pages > 0, `${prefix} suggestions`);
    assert.ok(visibleCandidates(game).pages <= 50, `${prefix} must not enumerate unbounded matches`);
  }
  let game = startRound('medium');
  for (const value of 'shijie') game = dispatch(game, { type: 'letter', value }, 1);
  assert.ok(visibleCandidates(game).items.includes('世界'), 'suggestions should not depend on target text');
  game = dispatch(startRound('easy'), { type: 'letter', value: 'x' });
  game = dispatch(game, { type: 'letter', value: 'x' });
  assert.deepEqual(visibleCandidates(game), { items: [], page: 0, pages: 0 });
});

test('phrase candidate commits two characters, erases composition and cannot overflow', () => {
  let game = enter(startRound('easy'), 'nihao', '你好');
  assert.equal(game.committed, '你好');
  assert.equal(game.pinyin, '');
  game = dispatch(game, { type: 'punctuation', value: '，' }, 100);
  game = enter(game, 'shijie', '世界');
  assert.equal(game.committed, '你好，世界');
  for (const value of 'nihao') game = dispatch(game, { type: 'letter', value }, 100);
  const index = visibleCandidates(game).items.indexOf('你好');
  assert.equal(index, -1, 'oversized words should not occupy visible candidate slots');
  game = dispatch(game, { type: 'backspace' }, 100);
  assert.equal(game.pinyin, 'niha');
  while (game.pinyin) game = dispatch(game, { type: 'backspace' }, 100);
  game = dispatch(game, { type: 'punctuation', value: '！' }, 200);
  assert.equal(game.endedAt, 200);
  assert.equal(scoreRound(game).correct, [...ROUNDS.easy.target].length);
});

test('backspace edits composition first, then one committed character of a phrase', () => {
  let game = enter(startRound('easy'), 'nihao', '你好');
  game = dispatch(game, { type: 'letter', value: 's' }, 100);
  game = dispatch(game, { type: 'backspace' }, 100);
  assert.equal(game.committed, '你好');
  game = dispatch(game, { type: 'backspace' }, 100);
  assert.equal(game.committed, '你');
  assert.equal(dispatch(game, { type: 'candidate', index: 20 }, 100), game);
});

test('all three existing rounds finish using real phrase input and single-character fallbacks', () => {
  const phrases = [['nihao', '你好'], ['shijie', '世界'], ['jintian', '今天'], ['tianqi', '天气'], ['women', '我们'], ['yiqi', '一起'], ['gongyuan', '公园'], ['rengongzhineng', '人工智能'], ['zhunque', '准确']];
  for (const level of Object.keys(ROUNDS)) {
    let game = startRound(level);
    let phraseCount = 0;
    const target = ROUNDS[level].target;
    for (let i = 0; i < [...target].length;) {
      const suffix = [...target].slice(i).join('');
      const phrase = phrases.find(([, word]) => suffix.startsWith(word));
      if (phrase) {
        game = enter(game, ...phrase);
        i += [...phrase[1]].length;
        phraseCount++;
      } else {
        const character = [...target][i];
        if (/\p{Script=Han}/u.test(character)) {
          const syllable = syllableFor(character);
          assert.ok(syllable, `missing reading for ${character}`);
          game = enter(game, syllable, character);
        } else game = dispatch(game, { type: 'punctuation', value: character }, 100);
        i++;
      }
    }
    assert.ok(phraseCount > 0, `${level} needs phrase coverage`);
    assert.equal(game.committed, target);
    assert.equal(game.endedAt, 100);
    assert.equal(scoreRound(game).accuracy, 100);
  }
});

test('a long common phrase and unrelated prefix can be entered without ranking explosion', () => {
  let game = startRound('hard');
  for (const value of 'rengongzhineng') game = dispatch(game, { type: 'letter', value }, 1);
  assert.ok(visibleCandidates(game).items.includes('人工智能'));
  game = dispatch(startRound('easy'), { type: 'letter', value: 's' }, 1);
  assert.ok(visibleCandidates(game).pages <= 50);
  assert.ok(visibleCandidates(game).items.every(word => /^[\p{Script=Han}]+$/u.test(word)));
});
test('finishing and scoring remain per character, with no physical input action', () => {
  const clean = { ...startRound('easy', 0), committed: '你好，世界！', actions: 12, endedAt: 10_000 };
  assert.equal(scoreRound({ ...clean, committed: '你坏，世界！' }).correct, 5);
  assert.ok(scoreRound(clean).score > scoreRound({ ...clean, actions: 25 }).score);
  assert.ok(scoreRound(clean).score > scoreRound({ ...clean, endedAt: 30_000 }).score);
  const game = { ...startRound('easy', 0), committed: '你坏，世界！' };
  assert.equal(dispatch(game, { type: 'letter', value: 'n' }, 1), game);
  assert.equal(dispatch(game, { type: 'finish' }, 1).endedAt, 1);
  assert.deepEqual(dispatch(startRound(), { type: 'letter', value: '你' }), startRound());
});
