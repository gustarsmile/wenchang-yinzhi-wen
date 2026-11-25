// 閱讀進度：種下的種子、讀過的頁、情境題的選擇、配對是否完成、上次讀到哪。
// 種子在程式裡沿用《太上感應篇》那本的名字（lamps、lightLamp、isLit）。
import { SAVE_KEY } from './config.js';
import { lampList, partChapters, partCount } from './book.js';
import { resolveStorage, tryRead, writeJson, removeKey, isPlainObject } from './storage.js';

const VERSION = 1;
const isIndex = (n) => Number.isInteger(n) && n >= 0;

function empty() {
  return { lamps: {}, seen: [], scenario: {}, match: false, last: '' };
}

// 存檔可能是舊版、被改過或壞掉：每個欄位都驗過才收，不合的丟掉
function sanitize(saved) {
  const s = empty();
  if (!isPlainObject(saved) || saved.v !== VERSION) return s;
  if (isPlainObject(saved.lamps)) {
    for (const [id, list] of Object.entries(saved.lamps)) {
      if (Array.isArray(list)) s.lamps[id] = [...new Set(list.filter(isIndex))];
    }
  }
  if (Array.isArray(saved.seen)) s.seen = [...new Set(saved.seen.filter((x) => typeof x === 'string'))];
  if (isPlainObject(saved.scenario)) {
    for (const [id, i] of Object.entries(saved.scenario)) if (isIndex(i)) s.scenario[id] = i;
  }
  s.match = saved.match === true;
  if (typeof saved.last === 'string') s.last = saved.last;
  return s;
}

export function createStore(storage) {
  const store = resolveStorage(storage);
  let s = sanitize(tryRead(store, SAVE_KEY).value);
  // 上一次寫入有沒有成功。寫不進去之後，storage 裡的就是舊資料，不能再拿來蓋掉手上的
  let synced = true;

  // 重新讀 storage：同一本書可能開在另一個分頁，那邊也在寫。
  // 每次要改之前都先讀一次再改，兩邊才不會拿著各自的舊資料互相蓋掉。
  function refresh() {
    if (!synced) return;
    const r = tryRead(store, SAVE_KEY);
    if (r.ok) s = sanitize(r.value);
  }
  function change(mutate) {
    refresh();
    mutate();
    synced = writeJson(store, SAVE_KEY, { v: VERSION, ...s }) || !store;
  }

  const isLit = (chId, idx) => (s.lamps[chId] || []).includes(idx);
  const isSeen = (chId) => s.seen.includes(chId);

  // 一頁「讀完」：有種子的頁要全部種下；沒有種子的頁，翻到過就算
  function isChapterComplete(chapter) {
    const list = lampList(chapter);
    if (list) return list.items.every((_, i) => isLit(chapter.id, i));
    return isSeen(chapter.id);
  }
  // 一段「讀完」：這一段的每一頁都讀完（這本書一段就是一頁）
  function isPartComplete(chapters, part) {
    const list = partChapters(chapters, part);
    return list.length > 0 && list.every(isChapterComplete);
  }

  return {
    refresh,

    // 新點亮才回 true（畫面據此決定要不要播動畫）
    lightLamp(chId, idx) {
      if (!isIndex(idx)) return false;
      let fresh = false;
      change(() => {
        if (isLit(chId, idx)) return;
        (s.lamps[chId] ||= []).push(idx);
        fresh = true;
      });
      return fresh;
    },
    isLit,
    litCount: (chId) => (s.lamps[chId] || []).length,
    totalLit: () => Object.values(s.lamps).reduce((sum, list) => sum + list.length, 0),

    markSeen(chId) {
      if (s.seen.includes(chId)) return;
      change(() => { if (!s.seen.includes(chId)) s.seen.push(chId); });
    },
    isSeen,

    setScenario(chId, i) {
      if (!isIndex(i)) return;
      change(() => { s.scenario[chId] = i; });
    },
    getScenario: (chId) => (chId in s.scenario ? s.scenario[chId] : null),

    setMatchDone() { change(() => { s.match = true; }); },
    isMatchDone: () => s.match,

    setLast(route) {
      if (s.last === String(route)) return;
      change(() => { s.last = String(route); });
    },
    getLast: () => s.last,

    isChapterComplete,
    isPartComplete,
    // 已讀完的段（1–11），由小到大
    completedParts(chapters) {
      const out = [];
      for (let part = 1; part <= partCount(chapters); part += 1) if (isPartComplete(chapters, part)) out.push(part);
      return out;
    },
    // 「我的福田」已經開了幾塊田：讀完的段，加上配對完成的「古今對照」
    plotsDone(chapters) {
      let n = s.match ? 1 : 0;
      for (let part = 1; part <= partCount(chapters); part += 1) if (isPartComplete(chapters, part)) n += 1;
      return n;
    },

    reset() {
      s = empty();
      removeKey(store, SAVE_KEY);
      synced = true;
    },
  };
}
