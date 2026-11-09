export const ROUNDS = {
  easy: { name: '热身', target: '你好，世界！' },
  medium: { name: '漫步', target: '今天的天气真好，我们一起去公园。' },
  hard: { name: '挑战', target: '人工智能能读懂文字，也需要耐心与准确。' },
};

export const DICTIONARY = {
  ni: ['你', '尼', '泥', '拟', '逆', '呢', '匿'],
  hao: ['好', '号', '浩', '毫', '豪', '耗', '郝'],
  shi: ['是', '时', '事', '十', '市', '世', '诗', '师'],
  jie: ['接', '节', '街', '借', '解', '界', '杰', '姐'],
  jin: ['今', '金', '近', '进', '仅', '尽', '紧'],
  tian: ['天', '田', '甜', '填', '添', '恬'],
  de: ['的', '得', '德'],
  qi: ['起', '气', '七', '期', '器', '奇', '齐', '棋', '其'],
  zhen: ['真', '针', '珍', '震', '阵', '枕', '诊'],
  wo: ['我', '握', '窝', '卧', '沃'],
  men: ['们', '门', '闷', '扪'],
  yi: ['一', '以', '已', '意', '衣', '易', '医', '义'],
  qu: ['去', '取', '曲', '区', '趣', '驱', '趋'],
  gong: ['公', '工', '共', '功', '宫', '供', '弓', '攻'],
  yuan: ['园', '原', '远', '元', '院', '圆', '源', '愿'],
  ren: ['人', '认', '任', '仁', '忍', '刃'],
  zhi: ['知', '只', '之', '指', '制', '智', '纸', '志'],
  neng: ['能'],
  du: ['读', '度', '独', '毒', '堵', '赌'],
  dong: ['懂', '动', '东', '冬', '洞', '冻'],
  wen: ['文', '问', '闻', '温', '稳', '纹'],
  zi: ['字', '自', '子', '资', '紫', '姿'],
  ye: ['也', '夜', '叶', '业', '野', '液'],
  xu: ['需', '许', '续', '须', '序', '虚'],
  yao: ['要', '药', '摇', '遥', '咬', '腰'],
  nai: ['耐', '奶', '奈', '乃'],
  xin: ['心', '新', '信', '欣', '辛', '薪'],
  yu: ['与', '语', '雨', '鱼', '于', '玉', '遇'],
  zhun: ['准', '谆'],
  que: ['确', '却', '缺', '雀'],
};

export function syllableFor(character) {
  return Object.keys(DICTIONARY).find(key => DICTIONARY[key].includes(character)) || null;
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
  const all = DICTIONARY[state.pinyin] || [];
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
  if (action.type === 'letter' && /^[a-z]$/.test(action.value) && state.pinyin.length < 8) {
    return { ...state, pinyin: state.pinyin + action.value, page: 0, actions: state.actions + 1 };
  }
  if (action.type === 'page' && (action.direction === 1 || action.direction === -1)) {
    const nextPage = state.page + action.direction;
    if (nextPage < 0 || nextPage >= visibleCandidates(state).pages) return state;
    return { ...state, page: nextPage, actions: state.actions + 1 };
  }
  if (action.type === 'candidate') {
    const char = visibleCandidates(state).items[action.index];
    if (!char) return state;
    return finishIfComplete({ ...state, committed: state.committed + char,
      pinyin: '', page: 0, actions: state.actions + 1 });
  }
  return state;
}
