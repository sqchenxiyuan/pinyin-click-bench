import { PACKED_LEXICON } from './lexicon.js';

export const LEXICON_VERSION = 'rime-ice/99662ba01e3affa6a0f009174ca530b887bac3b6/8105+base1000+ext4/v1';
export const ROUNDS = {
  easy: { name: '热身', target: '你好，世界！' },
  medium: { name: '漫步', target: '今天的天气真好，我们一起去公园。' },
  hard: { name: '挑战', target: '人工智能能读懂文字，也需要耐心与准确。' },
};
export const PAGE_SIZE = 5;
export const PUNCTUATION = ['，', '。', '！', '？', '、', '；'];
const MAX_SUGGESTIONS = 250;
// Sorted generated keys allow binary prefix lookup without a large prefix trie.
const keys = Object.keys(PACKED_LEXICON);
function lowerBound(needle) {
  let low = 0, high = keys.length;
  while (low < high) {
    const middle = (low + high) >> 1;
    if (keys[middle] < needle) low = middle + 1;
    else high = middle;
  }
  return low;
}
function entriesFor(key) {
  return PACKED_LEXICON[key].split(' ').map(record => {
    const divider = record.lastIndexOf(':');
    return { word: record.slice(0, divider), weight: Number(record.slice(divider + 1)) };
  });
}
// Reading lookup is independent of target strings and selects most frequent pronunciation.
const reading = new Map();
for (const key of keys) {
  if (key.length > 6) continue;
  for (const { word, weight } of entriesFor(key)) {
    if ([...word].length !== 1) continue;
    const previous = reading.get(word);
    if (!previous || weight > previous.weight || (weight === previous.weight && key < previous.key))
      reading.set(word, { key, weight });
  }
}
export function syllableFor(character) { return reading.get(character)?.key || null; }
const rank = (a, b) => b.weight - a.weight || (a.word < b.word ? -1 : a.word > b.word ? 1 : 0);
// Deduplicate readings by word before bounding the 250 best matches.
// This keeps frequent variants from consuming slots and allows a lower-ranked
// unique word to remain reachable; the temporary map lives only for one query.
function topCompletions(prefix) {
  const heap = [], best = new Map();
  const worse = (a, b) => rank(a, b) > 0;
  for (let i = lowerBound(prefix); i < keys.length && keys[i].startsWith(prefix); i++) {
    if (keys[i] === prefix) continue;
    for (const entry of entriesFor(keys[i])) {
      const previous = best.get(entry.word);
      if (!previous || rank(entry, previous) < 0) best.set(entry.word, entry);
    }
  }
  for (const entry of best.values()) {
      if (heap.length === MAX_SUGGESTIONS && !worse(heap[0], entry)) continue;
      if (heap.length === MAX_SUGGESTIONS) heap[0] = entry;
      else heap.push(entry);
      let at = heap.length === MAX_SUGGESTIONS ? 0 : heap.length - 1;
      if (heap.length === MAX_SUGGESTIONS) {
        while (true) {
          const left = at * 2 + 1, right = left + 1;
          if (left >= heap.length) break;
          const child = right < heap.length && worse(heap[right], heap[left]) ? right : left;
          if (!worse(heap[child], heap[at])) break;
          [heap[child], heap[at]] = [heap[at], heap[child]];
          at = child;
        }
      } else {
        while (at > 0) {
          const parent = (at - 1) >> 1;
          if (!worse(heap[at], heap[parent])) break;
          [heap[at], heap[parent]] = [heap[parent], heap[at]];
          at = parent;
        }
      }
  }
  return heap.sort(rank);
}
const suggestionCache = new Map();
function suggestions(prefix) {
  if (suggestionCache.has(prefix)) return suggestionCache.get(prefix);
  if (!keys[lowerBound(prefix)]?.startsWith(prefix)) return [];
  const exact = PACKED_LEXICON[prefix] ? entriesFor(prefix).sort(rank) : [];
  const unique = new Set(), result = [];
  for (const entry of [...exact, ...topCompletions(prefix)]) {
    if (unique.has(entry.word)) continue;
    unique.add(entry.word);
    result.push(entry.word);
    if (result.length === MAX_SUGGESTIONS) break;
  }
  if (suggestionCache.size >= 32) suggestionCache.delete(suggestionCache.keys().next().value);
  suggestionCache.set(prefix, result);
  return result;
}

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
  const remaining = [...ROUNDS[state.level].target].length - [...state.committed].length;
  const all = state.pinyin ? suggestions(state.pinyin).filter(word => [...word].length <= remaining) : [];
  return { items: all.slice(state.page * PAGE_SIZE, (state.page + 1) * PAGE_SIZE), page: state.page, pages: Math.ceil(all.length / PAGE_SIZE) };
}
export function dispatch(state, action, now = 0) {
  if (state.endedAt !== null) return state;
  if (action.type === 'finish') {
    if (state.pinyin || [...state.committed].length !== [...ROUNDS[state.level].target].length) return state;
    return { ...state, endedAt: now, actions: state.actions + 1 };
  }
  if ([...state.committed].length >= [...ROUNDS[state.level].target].length && action.type !== 'backspace') return state;
  const finishIfComplete = next => ({ ...next, endedAt: next.committed === ROUNDS[next.level].target ? now : null });
  if (action.type === 'backspace') {
    if (!state.pinyin && !state.committed) return state;
    return { ...state, pinyin: state.pinyin.slice(0, -1),
      committed: state.pinyin ? state.committed : [...state.committed].slice(0, -1).join(''),
      page: 0, actions: state.actions + 1 };
  }
  if (action.type === 'punctuation' && PUNCTUATION.includes(action.value)) {
    if (state.pinyin) return state;
    return finishIfComplete({ ...state, committed: state.committed + action.value, actions: state.actions + 1 });
  }
  if (action.type === 'letter' && /^[a-z]$/.test(action.value) && state.pinyin.length < 24)
    return { ...state, pinyin: state.pinyin + action.value, page: 0, actions: state.actions + 1 };
  if (action.type === 'page' && (action.direction === 1 || action.direction === -1)) {
    const nextPage = state.page + action.direction;
    if (nextPage < 0 || nextPage >= visibleCandidates(state).pages) return state;
    return { ...state, page: nextPage, actions: state.actions + 1 };
  }
  if (action.type === 'candidate') {
    const word = visibleCandidates(state).items[action.index];
    if (!word || [...state.committed].length + [...word].length > [...ROUNDS[state.level].target].length) return state;
    return finishIfComplete({ ...state, committed: state.committed + word, pinyin: '', page: 0, actions: state.actions + 1 });
  }
  return state;
}
