// localStorage 的安全包裝：無痕模式、被擋掉的 iframe、容量滿了，都可能丟例外。
// 這裡一律吞掉，讓書照樣能讀，只是不保存。

// 沒傳 storage（undefined）才去拿瀏覽器的；明確傳 null 代表「不要保存」
export function resolveStorage(storage) {
  if (storage !== undefined) return storage;
  try { return globalThis.localStorage ?? null; } catch { return null; }
}

// 讀取並分清楚兩種「沒有」：
//   ok: false → 根本讀不到（沒有 storage、被擋掉）。呼叫端應該留著手上的資料
//   ok: true, value: null → 讀得到，只是沒存過，或存的內容壞了
export function tryRead(storage, key) {
  if (!storage) return { ok: false, value: null };
  let raw;
  try { raw = storage.getItem(key); } catch { return { ok: false, value: null }; }
  if (raw == null) return { ok: true, value: null };
  try { return { ok: true, value: JSON.parse(raw) }; } catch { return { ok: true, value: null }; }
}

export const readJson = (storage, key) => tryRead(storage, key).value;

// 回傳有沒有真的寫進去（容量滿了、被擋掉都算沒有）
export function writeJson(storage, key, value) {
  if (!storage) return false;
  try { storage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
}

export function removeKey(storage, key) {
  try { storage?.removeItem(key); } catch { /* 存不了就算了 */ }
}

export const isPlainObject = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
