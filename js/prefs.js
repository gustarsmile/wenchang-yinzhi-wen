// 閱讀偏好（目前只有「顯示注音」）。和閱讀進度分開存：清除進度不會把偏好一起清掉。
import { PREFS_KEY } from './config.js';
import { resolveStorage, tryRead, writeJson, isPlainObject } from './storage.js';

const VERSION = 1;

// 存檔可能是舊版、被改過或壞掉：欄位驗過才收，不合的用預設值
function sanitize(saved) {
  const ok = isPlainObject(saved) && saved.v === VERSION;
  return { zhuyin: ok && saved.zhuyin === true };
}

export function createPrefs(storage) {
  const store = resolveStorage(storage);
  let p = sanitize(tryRead(store, PREFS_KEY).value);

  return {
    // 同一本書可能開在另一個分頁，那邊改了偏好
    refresh() {
      const r = tryRead(store, PREFS_KEY);
      if (r.ok && r.value !== null) p = sanitize(r.value);
    },
    getZhuyin: () => p.zhuyin,
    // 存不進去（無痕模式、被擋掉的 iframe）也沒關係：這一次開著的期間還是記得
    setZhuyin(on) {
      p.zhuyin = on === true;
      writeJson(store, PREFS_KEY, { v: VERSION, ...p });
    },
  };
}
