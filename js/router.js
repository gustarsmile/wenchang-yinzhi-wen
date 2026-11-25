// hash ↔ 路由。路由是字串：''（封面）、'toc'、'ch/3'、'match'、'land'、'daily'、'about'。
const FIXED = ['toc', 'match', 'land', 'daily', 'about'];
const COVER = { name: 'cover', route: '' };

// 認不得的一律回封面（手打錯的網址、舊連結、頁數超出範圍）。
// maxChapter 的預設值是這本書的頁數（11）；實際呼叫的地方都會傳 book.chapters.length
export function parseRoute(hash, maxChapter = 11) {
  const path = String(hash || '').replace(/\/$/, '');
  const ch = /^#\/ch\/(\d{1,2})$/.exec(path);
  if (ch) {
    const no = Number(ch[1]);
    return no >= 1 && no <= maxChapter ? { name: 'ch', no, route: `ch/${no}` } : { ...COVER };
  }
  const fixed = /^#\/([a-z]+)$/.exec(path);
  if (fixed && FIXED.includes(fixed[1])) return { name: fixed[1], route: fixed[1] };
  return { ...COVER };
}

export const toHash = (route) => `#/${route}`;
