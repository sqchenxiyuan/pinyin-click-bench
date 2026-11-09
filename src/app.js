import { ROUNDS, PUNCTUATION, LEXICON_VERSION, startRound, dispatch, visibleCandidates, scoreRound } from './ime.js';

const RECORD_KEY = 'ziji-record-v2';
const RECORD_SCHEMA = `2/${LEXICON_VERSION}/score-v1`;

const levels = Object.keys(ROUNDS);
const app = document.querySelector('#app');
let round = startRound('easy', Date.now());
let record = Object.create(null);
let hasStarted = false;
try {
  const saved = JSON.parse(localStorage.getItem(RECORD_KEY) || '{}');
  if (saved.schema === RECORD_SCHEMA && saved.best && typeof saved.best === 'object') record = saved.best;
} catch { record = Object.create(null); }

const safe = text => String(text).replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[character]);
const actionButton = (label, action, value, extraClass = '', disabled = false, title = '') =>
  `<button type="button" class="${extraClass}" data-action="${safe(action)}" data-value="${safe(value)}" ${disabled ? 'disabled' : ''} ${title ? `aria-label="${safe(title)}"` : ''}>${label}</button>`;
const formattedTime = ms => `${(ms / 1000).toFixed(1)}s`;

function saveRecord() {
  const previous = record[round.level];
  const metrics = scoreRound(round, round.endedAt);
  if (!previous || metrics.score > previous.score) {
    record[round.level] = { score: metrics.score, accuracy: metrics.accuracy, seconds: metrics.seconds, actions: metrics.actions };
    try { localStorage.setItem(RECORD_KEY, JSON.stringify({ schema: RECORD_SCHEMA, best: record })); } catch { /* storage can be disabled */ }
  }
}

function selectLevel(level) {
  if (!ROUNDS[level]) return;
  round = startRound(level, Date.now());
  hasStarted = false;
  render();
}

function applyAction(action) {
  if (!hasStarted) {
    round = { ...round, startedAt: Date.now() };
    hasStarted = true;
  }
  const wasFinished = round.endedAt !== null;
  round = dispatch(round, action, Date.now());
  if (!wasFinished && round.endedAt !== null) saveRecord();
  render();
}

function targetMarkup() {
  const chars = [...ROUNDS[round.level].target];
  const typed = [...round.committed];
  return chars.map((char, index) => {
    const state = index < typed.length ? (char === typed[index] ? 'correct' : 'incorrect') : index === typed.length ? 'current' : 'pending';
    return `<span class="target-char ${state}" ${state === 'current' ? 'aria-current="true"' : ''}>${safe(char)}</span>`;
  }).join('');
}

function render() {
  const now = Date.now();
  const target = ROUNDS[round.level].target;
  const typedLength = [...round.committed].length;
  const targetLength = [...target].length;
  const finished = round.endedAt !== null;
  const metrics = scoreRound(round, now);
  const candidates = visibleCandidates(round);
  const canEnter = !finished && typedLength < targetLength && round.pinyin.length < 24;
  const nextLevel = levels[levels.indexOf(round.level) + 1];
  const best = record[round.level];
  const pageLabel = candidates.pages ? `${candidates.page + 1} / ${candidates.pages}` : '— / —';

  app.innerHTML = `
    <div class="page-shell">
      <header class="topbar">
        <a class="brand" href="./" aria-label="字击 · 返回首页"><span class="brand-stamp">字</span><span class="brand-text">字击 <small>PINYIN CLICK BENCH</small></span></a>
        <div class="top-right"><span class="live-dot"></span> 视觉点击输入实验 <span class="version">/ 001</span></div>
      </header>
      <main>
        <section class="intro">
          <div class="intro-copy"><p class="eyebrow"><span class="rule-line"></span> NO TYPING. JUST CLICKING.</p>
            <h1>看见汉字，<em>点出来。</em></h1>
            <p class="lede">一场给人和视觉智能体的中文输入小测验。看目标、点拼音、选汉字；每一步都算数。</p>
          </div>
          <div class="intro-art" aria-hidden="true"><div class="art-grid"><span>n</span><span>ǐ</span><span>→</span><span class="art-hanzi">你</span></div><div class="art-caption">visual in · click out</div></div>
        </section>
        <section class="workspace" aria-label="中文输入挑战">
          <div class="workspace-top"><div class="section-kicker">01 <span>／ 选择关卡</span></div><span class="tiny-label">选择关卡会重新开始当前进度</span></div>
          <div class="level-tabs" role="group" aria-label="难度选择">
            ${levels.map((level, i) => `<button type="button" class="level-tab ${round.level === level ? 'selected' : ''}" data-level="${level}" aria-pressed="${round.level === level}"><span class="level-number">0${i + 1}</span><span>${ROUNDS[level].name}</span><span class="level-size">${[...ROUNDS[level].target].length} 字</span></button>`).join('')}
          </div>
          <div class="play-area">
            <div class="challenge-heading"><div><span class="section-kicker">02 <span>／ 目标文本</span></span><h2>照着这一句来</h2></div><div class="round-label">${ROUNDS[round.level].name.toUpperCase()} / ${typedLength} — ${targetLength}</div></div>
            <div class="target-text" aria-label="目标文本：${safe(target)}">${targetMarkup()}</div>
            <div class="progress-track" role="progressbar" aria-label="输入进度" aria-valuenow="${typedLength}" aria-valuemin="0" aria-valuemax="${targetLength}"><div style="width:${Math.min(100, typedLength / targetLength * 100)}%"></div></div>
            <div class="input-head"><span class="section-kicker">03 <span>／ 已输入</span></span><span class="read-only-pill"><span aria-hidden="true">●</span> 只读 · 点击输入</span></div>
            <div class="input-display" aria-label="已输入：${safe(round.committed || '空')}"><span class="committed">${[...round.committed].map((character, index) => `<span class="${character === [...target][index] ? 'match' : 'mismatch'}">${safe(character)}</span>`).join('')}</span><span class="composition">${safe(round.pinyin)}</span>${!finished ? '<span class="caret" aria-hidden="true"></span>' : ''}${!round.committed && !round.pinyin ? '<span class="placeholder">点击下方键盘，输入拼音…</span>' : ''}</div>
            <div class="candidate-wrap"><div class="candidate-header"><div><span class="candidate-heading">候选字词</span><span class="candidate-syllable">${round.pinyin ? safe(round.pinyin) : '等待拼音'}</span></div><span class="candidate-page">${pageLabel}</span></div>
              <div class="candidate-row" role="group" aria-label="候选字词选择">
                ${candidates.items.length ? candidates.items.map((word, index) => actionButton(`<span class="candidate-index">${index + 1}</span><span class="candidate-char">${safe(word)}</span>`, 'candidate', index, 'candidate-key', finished, `候选字词 ${word}`)).join('') : `<div class="candidate-empty">${round.pinyin ? '没有匹配的字词 · 点击退格修改拼音' : '点击字母输入拼音，候选字词会随前缀出现'}</div>`}
              </div>
              <div class="pagination">${actionButton('← 上一页', 'page', -1, 'page-button', finished || !candidates.page)}<span>每页最多 5 个候选字词</span>${actionButton('下一页 →', 'page', 1, 'page-button', finished || candidates.page >= candidates.pages - 1)}</div>
            </div>
            <div class="keyboard-zone"><div class="keyboard-head"><span class="section-kicker">04 <span>／ 点击键盘</span></span><span class="tiny-label">实体键盘不能输入内容</span></div>
              <div class="keyboard" role="group" aria-label="虚拟拼音键盘">
                ${['qwertyuiop', 'asdfghjkl', 'zxcvbnm'].map((row, index) => `<div class="key-row key-row-${index}">${[...row].map(letter => actionButton(letter, 'letter', letter, 'letter-key', !canEnter)).join('')}</div>`).join('')}
                <div class="key-row utility-row">${actionButton('，<small>逗号</small>', 'punctuation', '，', 'punct-key', !canEnter || !!round.pinyin)}${actionButton('。<small>句号</small>', 'punctuation', '。', 'punct-key', !canEnter || !!round.pinyin)}${actionButton('！<small>感叹</small>', 'punctuation', '！', 'punct-key', !canEnter || !!round.pinyin)}${actionButton('？<small>问号</small>', 'punctuation', '？', 'punct-key', !canEnter || !!round.pinyin)}${actionButton('、', 'punctuation', '、', 'punct-key small-key', !canEnter || !!round.pinyin)}${actionButton('；', 'punctuation', '；', 'punct-key small-key', !canEnter || !!round.pinyin)}${actionButton('⌫ <small>退格</small>', 'backspace', '', 'backspace-key', finished || (!round.pinyin && !round.committed))}</div>
              </div>
              <p class="keyboard-tip">逐个点击字母输入无声调拼音；候选字词随前缀出现，完整拼音可缩小范围。点击候选提交整个字词，标点直接点击，错误点「退格」。</p>
            </div>
          </div>
          <div class="score-strip"><div class="score-cell"><span>准确率</span><strong>${metrics.accuracy}<small>%</small></strong></div><div class="score-cell"><span>用时</span><strong data-clock>${formattedTime(metrics.elapsedMs)}</strong></div><div class="score-cell"><span>点击</span><strong>${metrics.actions}<small> 次</small></strong></div><div class="score-cell score-highlight"><span>当前得分</span><strong data-score>${metrics.score}</strong></div></div>
          <div class="controls"><div class="record">${best ? `◈ 本关最佳 <strong>${best.score}</strong> 分 <span>· ${best.accuracy}% · ${best.seconds.toFixed(1)}s</span>` : '◈ 本关尚无记录 · 首次完成即可保存'}</div><div class="control-buttons">${actionButton('↺ 重新开始', 'restart', '', 'secondary-button')}${finished ? (nextLevel ? actionButton(`下一关 ${ROUNDS[nextLevel].name} →`, 'next', '', 'primary-button') : actionButton('重玩挑战 ↗', 'restart', '', 'primary-button')) : actionButton('结束并交卷 →', 'finish', '', 'primary-button', typedLength !== targetLength || !!round.pinyin)}</div></div>
          ${finished ? `<div class="result-panel" role="status"><div class="result-icon">${metrics.accuracy === 100 ? '✦' : '◇'}</div><div><span class="section-kicker">ROUND COMPLETE</span><h3>${metrics.accuracy === 100 ? '精准命中！' : '已交卷，继续练习。'}</h3><p>${metrics.correct} / ${metrics.total} 字正确 · ${formattedTime(metrics.elapsedMs)} · ${metrics.actions} 次点击 · 得分 <strong>${metrics.score}</strong></p></div></div>` : ''}
        </section>
        <section class="rules" id="rules"><div class="rules-left"><span class="section-kicker">THE RULES <span>／ 玩法说明</span></span><h2>公平，从每次点击开始。</h2><p>这个实验刻意不提供输入框。无论是人还是视觉智能体，都需要通过可见的按钮完成整句话。</p></div><div class="rules-list"><div><span>01</span><p><strong>只用可见按钮</strong>点 QWERTY 字母；候选字词随无声调拼音前缀出现。词库来自固定版本的 MIT 来源语料，单字有大量同音候选；完整拼音更易缩小范围。每页 5 项，最多展示前 250 项，翻页计点击；不是系统输入法，不支持联想整句。</p></div><div><span>02</span><p><strong>字词一起提交</strong>：输入连续拼音（如 nihao）可选「你好」一键提交两个字；超过目标剩余字数的候选不显示。中文标点直接点按钮；退格优先删除未提交拼音，清空后逐字删除已提交内容。</p></div><div><span>03</span><p><strong>交卷与计分</strong>：完全匹配目标时自动结束；达到目标字数但不完全正确时可点「结束并交卷」。逐位置比较准确率，时间和额外点击会拉低分数。</p></div><div><span>04</span><p><strong>固定版本</strong>：词库 ${safe(LEXICON_VERSION)}、文本与候选排序不随关卡变化；计时从首次有效输入起算。本地最高分独立存储为 v2，不与旧版小词库成绩混算。<a href="./NOTICE.md">词库来源及 MIT 许可</a>。</p></div></div></section>
      </main><footer><span>字击 <span class="footer-spark">✳</span> PINYIN CLICK BENCH</span><span>给眼睛一份试卷，给手指一场挑战。</span><a href="#rules">返回规则 ↑</a></footer>
    </div>`;
}

app.addEventListener('click', event => {
  const button = event.target.closest('button');
  if (!button || button.disabled || !app.contains(button)) return;
  if (button.dataset.level) return selectLevel(button.dataset.level);
  const action = button.dataset.action;
  if (action === 'restart') return selectLevel(round.level);
  if (action === 'next') return selectLevel(levels[levels.indexOf(round.level) + 1]);
  if (action === 'letter') return applyAction({ type: 'letter', value: button.dataset.value });
  if (action === 'candidate') return applyAction({ type: 'candidate', index: Number(button.dataset.value) });
  if (action === 'page') return applyAction({ type: 'page', direction: Number(button.dataset.value) });
  if (action === 'punctuation') return applyAction({ type: 'punctuation', value: button.dataset.value });
  if (action === 'backspace' || action === 'finish') applyAction({ type: action });
});

// The physical keyboard never mutates the game. Button activation remains accessible
// through Tab/Enter/Space; there is no text input, paste handler, or hidden textarea.
setInterval(() => {
  if (!hasStarted || round.endedAt !== null) return;
  const clock = app.querySelector('[data-clock]');
  const score = app.querySelector('[data-score]');
  if (clock && score) {
    const metrics = scoreRound(round, Date.now());
    clock.textContent = formattedTime(metrics.elapsedMs);
    score.textContent = metrics.score;
  }
}, 100);
render();
