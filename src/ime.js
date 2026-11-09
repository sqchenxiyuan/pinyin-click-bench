import { PACKED_LEXICON } from './lexicon.js';

export const LEXICON_VERSION = 'jieba-0.42.1+pinyin-pro-3.27.0/no-hsk/v1';
export const ROUNDS = {
  easy: { name: '热身', target: '你好，世界！' },
  medium: { name: '漫步', target: '今天的天气真好，我们一起去公园。' },
  hard: { name: '挑战', target: '人工智能能读懂文字，也需要耐心与准确。' },
};

// Packed records are <n Han characters><n tone digits><base-36 frequency class>.
// Do not read all records on every click: cache one bounded prefix list per composition.
const wordLength = key => key.split(' ').length;
const decoded = new Map();
const reading = new Map();
const prefixes = new Map();
const MAX_SUGGESTIONS = 250;
const keys = Object.keys(PACKED_LEXICON);
for (const key of keys) {
  const plain = key.replaceAll(' ', '');
  for (let i = 1; i <= plain.length; i++) {
    const prefix = plain.slice(0, i);
    if (!prefixes.has(prefix)) prefixes.set(prefix, []);
    prefixes.get(prefix).push(key);
  }
}
function entriesFor(key) {
  if (decoded.has(key)) return decoded.get(key);
  const n = wordLength(key), raw = PACKED_LEXICON[key], entries = [];
  for (let offset = 0; offset < raw.length; offset += 2 * n + 1) {
    const word = raw.slice(offset, offset + n);
    const cls = parseInt(raw[offset + 2 * n], 36);
    entries.push({ word, cls });
    if (n === 1 && !reading.has(word)) reading.set(word, key);
  }
  decoded.set(key, entries);
  return entries;
}
// Reading lookup is built once from single-character entries, independently of target text.
for (const key of keys) if (!key.includes(' ')) entriesFor(key);

export function syllableFor(character) {
  return reading.get(character) || null;
}

const suggestionCache = new Map();
function suggestions(prefix) {
  if (!prefixes.has(prefix)) return [];
  if (suggestionCache.has(prefix)) return suggestionCache.get(prefix);
  // Exact full pinyin syllables/phrases first; other completions follow corpus rank.
  const exact = [], partial = [];
  for (const key of prefixes.get(prefix)) {
    const bucket = key.replaceAll(' ', '') === prefix ? exact : partial;
    for (const entry of entriesFor(key)) bucket.push(entry);
  }
  const rank = (a, b) => b.cls - a.cls || (a.word < b.word ? -1 : a.word > b.word ? 1 : 0);
  exact.sort(rank);
  partial.sort(rank);
  const unique = new Set(), result = [];
  for (const entry of [...exact, ...partial]) {
    if (unique.has(entry.word)) continue;
    unique.add(entry.word);
    result.push(entry.word);
    if (result.length === MAX_SUGGESTIONS) break;
  }
  suggestionCache.set(prefix, result);
  return result;
}
export const PAGE_SIZE = 5;
export const PUNCTUATION = ['，', '。', '！', '？', '、', '；'];

export function scoreRound(state, now = 0) {
  const target = [...ROUNDS[state.level].target];
  const typed = [...state.committed];
  const correct = target.reduce((sum, char, index) => sum + Number(char === typed[index]), 0);
  const accuracy = Math.round((correct / target.length) * 100);
  const elapsedMs = Math.max(0, (state.endedAt ?? now) - state.startedAt);
  const seconds = elapsedMs / 1000;
  const extraActions = Math.max(0, state.actions - target.length);
  const score = Math.round(1000 * (correct / target.length) ** 2 /
    (1 + seconds / 30 + extraActions / target.length * 0.025));
  return { correct, total: target.length, accuracy, elapsedMs, seconds, actions: state.actions, score };
}


export function startRound(level = 'easy', now = 0) {
  if (!ROUNDS[level]) throw new Error(`Unknown round: ${level}`);
  return { level, committed: '', pinyin: '', page: 0, actions: 0, startedAt: now, endedAt: null };
}

export function visibleCandidates(state) {
  const all = state.pinyin ? suggestions(state.pinyin).filter(word =>
    [...word].length <= [...ROUNDS[state.level].target].length - [...state.committed].length) : [];
  return { items: all.slice(state.page * PAGE_SIZE, (state.page + 1) * PAGE_SIZE), page: state.page, pages: Math.ceil(all.length / PAGE_SIZE) };
}

export function dispatch(state, action, now = 0) {
  if (state.endedAt !== null) return state;
  if (action.type === 'finish') {
    if (state.pinyin || [...state.committed].length !== [...ROUNDS[state.level].target].length) return state;
    return { ...state, endedAt: now, actions: state.actions + 1 };
  }
  if ([...state.committed].length >= [...ROUNDS[state.level].target].length && action.type !== 'backspace') return state;
  const finishIfComplete = next => ({
    ...next,
    endedAt: next.committed === ROUNDS[next.level].target ? now : null,
  });
  if (action.type === 'backspace') {
    if (!state.pinyin && !state.committed) return state;
    return { ...state, pinyin: state.pinyin.slice(0, -1),
      committed: state.pinyin ? state.committed : state.committed.slice(0, -1),
      page: 0, actions: state.actions + 1 };
  }
  if (action.type === 'punctuation' && PUNCTUATION.includes(action.value)) {
    if (state.pinyin) return state;
    return finishIfComplete({ ...state, committed: state.committed + action.value,
      actions: state.actions + 1 });
  }
  if (action.type === 'letter' && /^[a-z]$/.test(action.value) && state.pinyin.length < 24) {
    return { ...state, pinyin: state.pinyin + action.value, page: 0, actions: state.actions + 1 };
  }
  if (action.type === 'page' && (action.direction === 1 || action.direction === -1)) {
    const nextPage = state.page + action.direction;
    if (nextPage < 0 || nextPage >= visibleCandidates(state).pages) return state;
    return { ...state, page: nextPage, actions: state.actions + 1 };
  }
  if (action.type === 'candidate') {
    const char = visibleCandidates(state).items[action.index];
    if (!char || [...state.committed].length + [...char].length > [...ROUNDS[state.level].target].length) return state;
    return finishIfComplete({ ...state, committed: state.committed + char,
      pinyin: '', page: 0, actions: state.actions + 1 });
  }
  return state;
}
