// 每日種福：利人、利物、陰功，每天三項自我檢核。紀錄以「本地日期」為鍵，只存在瀏覽器裡。
import { DAILY_KEY } from './config.js';
import { resolveStorage, tryRead, writeJson, isPlainObject } from './storage.js';

const VERSION = 1;
const ITEMS = 3;
const KEEP_DAYS = 90;
const KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

// 用本地的年月日，不用 toISOString（那是 UTC，台灣早上八點前會算成前一天）
export function dateKey(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const isDayRecord = (x) => Array.isArray(x) && x.length === ITEMS && x.every((b) => typeof b === 'boolean');
const isCount = (n) => Number.isInteger(n) && n >= 0;

// 存檔可能是舊版、被改過或壞掉：每個欄位都驗過才收
function sanitize(saved) {
  const data = { days: {}, archived: 0 };
  if (!isPlainObject(saved) || saved.v !== VERSION) return data;
  if (isPlainObject(saved.days)) {
    for (const [key, rec] of Object.entries(saved.days)) {
      if (KEY_RE.test(key) && isDayRecord(rec)) data.days[key] = rec;
    }
  }
  if (isCount(saved.archived)) data.archived = saved.archived;
  return data;
}

const count = (rec) => rec.filter(Boolean).length;
const inRange = (i) => Number.isInteger(i) && i >= 0 && i < ITEMS;

export function createDaily(storage, now = () => new Date()) {
  const store = resolveStorage(storage);
  let { days, archived } = sanitize(tryRead(store, DAILY_KEY).value);
  let synced = true; // 上一次寫入有沒有成功（同 state.js：寫不進去之後不再拿 storage 的舊資料蓋掉手上的）

  // 另一個分頁可能也在勾：要改之前先重讀
  function refresh() {
    if (!synced) return;
    const r = tryRead(store, DAILY_KEY);
    if (r.ok) ({ days, archived } = sanitize(r.value));
  }
  // 只留最近 90 天的逐日紀錄；更早的那幾天不留明細，但它們的善要加進 archived，「累積」才不會變少。
  // 今天這一筆永遠留著：裝置的時鐘被調回去時，今天會比所有紀錄都「舊」，
  // 如果照日期把它收掉，今天的勾就留不住，而且每點一次累積就多算一次。
  function save() {
    const todayKey = keyDaysAgo(0);
    const keys = Object.keys(days).filter((k) => k !== todayKey).sort();
    const keep = days[todayKey] ? KEEP_DAYS - 1 : KEEP_DAYS;
    const drop = keys.slice(0, Math.max(0, keys.length - keep));
    for (const k of drop) { archived += count(days[k]); delete days[k]; }
    synced = writeJson(store, DAILY_KEY, { v: VERSION, days, archived }) || !store;
  }

  // 往回數第 n 天的日期鍵（n = 0 是今天）。用年月日去減，跨月、跨年、日光節約都不會錯
  function keyDaysAgo(n) {
    const t = now();
    return dateKey(new Date(t.getFullYear(), t.getMonth(), t.getDate() - n));
  }

  const today = () => [...(days[keyDaysAgo(0)] || Array(ITEMS).fill(false))];

  // 每次都重新算「今天」：網頁開著跨過午夜，寫進去的就是新的一天
  function set(i, value) {
    if (!inRange(i)) return false;
    refresh();
    const rec = today();
    rec[i] = Boolean(value);
    days[keyDaysAgo(0)] = rec;
    save();
    return rec[i];
  }

  return {
    refresh,
    today,
    todayKey: () => keyDaysAgo(0),
    set,
    toggle(i) {
      if (!inRange(i)) return false;
      refresh();
      return set(i, !today()[i]);
    },
    countToday: () => count(today()),
    // 從開始記錄到現在，一共勾了幾件（含已經不留明細的舊日子）
    total: () => archived + Object.values(days).reduce((sum, rec) => sum + count(rec), 0),
    // 最近 n 天，由舊到新；沒有紀錄的那天 count 是 null
    history(n = 7) {
      const out = [];
      for (let k = n - 1; k >= 0; k -= 1) {
        const key = keyDaysAgo(k);
        out.push({ key, count: days[key] ? count(days[key]) : null });
      }
      return out;
    },
    // 連續幾天至少勾了一項。今天還沒勾不算中斷（今天還沒過完），從昨天往回數
    streak() {
      const done = (k) => Boolean(days[keyDaysAgo(k)]) && count(days[keyDaysAgo(k)]) > 0;
      let k = done(0) ? 0 : 1;
      let n = 0;
      while (done(k)) { n += 1; k += 1; }
      return n;
    },
  };
}
