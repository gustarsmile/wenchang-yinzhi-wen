// 注音查證：把全文用到的每個字，逐字到教育部的兩部辭典查出所有讀音，
// 再檢查 js/data/zhuyin.json 選的讀音都在辭典列的讀音裡，並列出「破音字清單」供人工覆核。
//
//   node scripts/zhuyin-check.mjs fetch     只查還沒查過的字，存進 content-src/zhuyin-dict/（不進 git）
//   node scripts/zhuyin-check.mjs init      從辭典快取起一份 zhuyin.json 的底稿（新書開工時用一次；phrases 會留著）
//   node scripts/zhuyin-check.mjs           檢查並印出摘要；有問題時結束碼為 1
//   node scripts/zhuyin-check.mjs --list    另外印出完整的破音字清單（每一處的句子、選的讀音、辭典列的讀音與釋義）
//
// 兩個來源：
//   重編  《重編國語辭典修訂本》，透過萌典 https://www.moedict.tw/a/<字>.json（古義、讀音／語音／又音都收）
//   簡編  《國語辭典簡編本》 https://dict.concised.moe.edu.tw/（依《國語一字多音審訂表》，是現行教學用的標準讀音）
//         破音字另外把簡編收的、含有這個字的詞全部查回來（詞的讀音是判斷時的旁證）
// 辭典資料只當查證用的快取，不放進 repo。請求一次只帶一個字，一筆一筆慢慢查，不平行。
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { annotate, isHan, isSyllable } from '../js/zhuyin.js';

const CACHE_DIR = 'content-src/zhuyin-dict';
const ZHUYIN = 'js/data/zhuyin.json';
const DELAY_MS = 600;
const UA = 'zhuyin-check (single-character dictionary lookup)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));
const hex = (ch) => ch.codePointAt(0).toString(16).toUpperCase();

const concisedUrl = (ch) => `https://dict.concised.moe.edu.tw/search.jsp?md=1&word=${encodeURIComponent(ch)}`;
// 每一種快取各放一個資料夾
const SOURCES = {
  moe: { name: '重編', url: (ch) => `https://www.moedict.tw/a/${encodeURIComponent(ch)}.json` },
  concised: { name: '簡編', url: concisedUrl },
  words: { name: '簡編的詞', url: (ch) => `${concisedUrl(ch)}&size=-1` }, // 同一個檢索，筆數設成全部；只查破音字
};
const cachePath = (source, ch) => `${CACHE_DIR}/${source}/${hex(ch)}.json`;

// 通假：這個字在句子裡是當另一個字用，讀那個字的音；辭典在這個字底下沒有列這個音。
// 每一條都要寫明出處，查證時會去查「被借的那個字」，確認讀音真的是它的。
// 寫法：字: { as: '被借的字', why: '出處' }。《陰騭文》目前沒有需要這樣處理的字。
const LOANS = {};

// 全書的原文：每一段、清單的每一列各是一筆
function loadRaws() {
  const out = [];
  for (const ch of readJson('js/data/chapters.json')) {
    for (const b of ch.blocks) {
      if (b.type === 'list') b.items.forEach((it, i) => out.push({ where: `${ch.id} 第${i + 1}列`, raw: it.raw }));
      else out.push({ where: ch.id, raw: b.raw });
    }
  }
  return out;
}

const uniqueChars = (raws) => [...new Set(raws.flatMap((r) => [...r.raw]).filter(isHan))];

// ── 查辭典 ──
async function fetchOne(source, ch) {
  const url = SOURCES[source].url(ch);
  for (let attempt = 1; ; attempt += 1) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA } });
      if (res.status === 404) return { char: ch, url, status: 404, text: '' };
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return { char: ch, url, status: 200, text: await res.text() };
    } catch (err) {
      if (attempt >= 3) throw err;
      await sleep(DELAY_MS * 5 * attempt);
    }
  }
}

// 只查還沒有快取的；回傳沒查到的字數
async function fetchMissing(source, chars, what) {
  mkdirSync(`${CACHE_DIR}/${source}`, { recursive: true });
  const todo = chars.filter((ch) => !existsSync(cachePath(source, ch)));
  console.log(`${SOURCES[source].name}｜${what} ${chars.length} 個，已有快取 ${chars.length - todo.length}，要查 ${todo.length}`);
  let failed = 0;
  for (const [i, ch] of todo.entries()) {
    try {
      const entry = await fetchOne(source, ch);
      writeFileSync(cachePath(source, ch), JSON.stringify({ ...entry, fetchedAt: new Date().toISOString() }));
    } catch (err) {
      failed += 1;
      console.log(`  ${ch}：查不到（${err.message}）`);
    }
    if ((i + 1) % 50 === 0) console.log(`  …${i + 1}／${todo.length}`);
    await sleep(DELAY_MS);
  }
  return failed;
}

async function fetchAll(chars) {
  let failed = 0;
  for (const source of ['moe', 'concised']) failed += await fetchMissing(source, chars, '全文不同的字');
  // 辭典說是異體字的（「台」是「臺」的異體字）和通假的字，把正字也查回來
  const extra = [...new Set([...chars.flatMap((ch) => variantTargets(ch)), ...Object.values(LOANS).map((l) => l.as)])];
  if (extra.length) for (const source of ['moe', 'concised']) failed += await fetchMissing(source, extra, '異體字的正字、通假的字');
  failed += await fetchMissing('words', chars.filter((ch) => lookup(ch).all.length > 1), '破音字');
  console.log(failed ? `有 ${failed} 筆沒查到，再跑一次 fetch 會只補這些。` : '查完了。');
  return failed;
}

// ── 讀快取 ──
const cached = (source, ch) => (existsSync(cachePath(source, ch)) ? readJson(cachePath(source, ch)) : null);
const clean = (s) => String(s || '').replace(/[`~]/g, '');
// 輕聲的點一律放最前面；去掉空白
const tidy = (s) => { const t = clean(s).replace(/[\s　]/g, ''); return t.includes('˙') ? `˙${t.replace(/˙/g, '')}` : t; };

function moeBody(ch) {
  const c = cached('moe', ch);
  if (!c || c.status !== 200) return null;
  try { return JSON.parse(c.text); } catch { return null; }
}

// 重編把這個字當成另一個字的異體（「台」→「臺」）時，正字是哪一個
function variantTargets(ch) {
  const out = [];
  for (const h of moeBody(ch)?.h || []) {
    for (const d of h.d || []) {
      const m = clean(d.f).match(/^「(.)」的異體字/);
      if (m) out.push(m[1]);
    }
  }
  return out;
}

// 重編：[{ syllable, defs }]。一個讀音一筆，defs 是那個讀音底下的釋義（含例詞）
function moeReadings(ch) {
  const out = [];
  for (const h of moeBody(ch)?.h || []) {
    if (!h.b) continue;
    const defs = (h.d || []).map((d) => `${d.type ? `〔${clean(d.type)}〕` : ''}${clean(d.f)}${(d.e || []).map(clean).join('')}`);
    out.push({ syllable: tidy(h.b), defs });
  }
  return out;
}

// 簡編的檢索結果是一張表：這個字本身（每個讀音一列，前面標 (一)(二)…），後面是含有這個字的詞。
// 一格裡除了正讀，有時還附「(變)」的變讀（輕聲等），那一段不算
function concisedRows(source, ch) {
  const c = cached(source, ch);
  if (!c || c.status !== 200) return [];
  const rows = [];
  const re = /<tr data-link=[^>]*>\s*<td>\d+<\/td>\s*<td>([\s\S]*?)<\/td>\s*<td([^>]*)>([\s\S]*?)<\/td>\s*<\/tr>/g;
  for (const m of c.text.matchAll(re)) {
    const word = m[1].replace(/<[^>]+>/g, '').trim();
    const order = (m[2].match(/data-pre="([^"]*)"/) || [])[1] || '';
    const main = m[3].replace(/<idiv>[\s\S]*?<\/idiv>/g, '');
    const readings = [...main.matchAll(/<phon>([\s\S]*?)<\/phon>/g)].map((p) => tidy(p[1].replace(/<[^>]+>/g, '')));
    rows.push({ word, order, readings });
  }
  return rows;
}
// 這個字在簡編的讀音，照 (一)(二)(三) 的順序
const rank = (order) => '一二三四五六七八九十'.indexOf(order.replace(/[()（）]/g, '')); // 只有一個讀音的字沒有編號
const concisedReadings = (ch) => concisedRows('concised', ch)
  .filter((r) => r.word === ch)
  .sort((a, b) => rank(a.order) - rank(b.order))
  .map((r) => r.readings[0]);
// 簡編收的、含有這個字的詞：[{ word, readings }]（一字一音對得上的才算）
const concisedWords = (ch) => concisedRows(cached('words', ch) ? 'words' : 'concised', ch)
  .filter((r) => [...r.word].length > 1 && [...r.word].length === r.readings.length);

// 一個字在辭典裡查得到的所有讀音
//   moe、concised  兩部辭典在這個字底下列的        own  兩邊合起來
//   extra          從異體字的正字、通假的字來的     all  全部
//   first          辭典列的第一個讀音（簡編的 (一)；簡編沒收這個字就用重編的第一個）——zhuyin.json 的 poly 用它當預設
function lookup(ch) {
  const moe = moeReadings(ch);
  const concised = [...new Set(concisedReadings(ch))];
  const extra = [];
  for (const v of variantTargets(ch)) {
    for (const s of new Set([...moeReadings(v).map((r) => r.syllable), ...concisedReadings(v)])) extra.push({ syllable: s, why: `「${v}」的異體字` });
  }
  if (LOANS[ch]) {
    const { as, why } = LOANS[ch];
    for (const s of new Set([...moeReadings(as).map((r) => r.syllable), ...concisedReadings(as)])) extra.push({ syllable: s, why: `通「${as}」。${why}` });
  }
  const own = [...new Set([...moe.map((r) => r.syllable), ...concised])];
  const all = [...new Set([...own, ...extra.map((e) => e.syllable)])];
  return { moe, concised, extra, own, all, first: concised[0] || moe[0]?.syllable || extra[0]?.syllable || null };
}

// 字所在的那一小句（到前後的標點為止），並把那個字用【】標出來
function clause(raw, index) {
  const chars = [...raw];
  let from = index;
  let to = index;
  while (from > 0 && isHan(chars[from - 1])) from -= 1;
  while (to < chars.length - 1 && isHan(chars[to + 1])) to += 1;
  return `${chars.slice(from, index).join('')}【${chars[index]}】${chars.slice(index + 1, to + 1).join('')}`;
}

// ── 檢查 ──
function check({ list }) {
  const raws = loadRaws();
  const chars = uniqueChars(raws);
  const zhuyin = readJson(ZHUYIN);
  const dict = new Map(chars.map((ch) => [ch, lookup(ch)]));
  const uniq = (items) => [...new Set(items)];

  const poly = chars.filter((ch) => dict.get(ch).all.length > 1);
  const noCache = chars.filter((ch) => !cached('moe', ch) || !cached('concised', ch) || (poly.includes(ch) && !cached('words', ch)));
  const notFound = chars.filter((ch) => dict.get(ch).all.length === 0);
  const odd = chars.flatMap((ch) => dict.get(ch).all.filter((s) => !isSyllable(s)).map((s) => `${ch} ${s}`));

  // 每個字在全文裡實際標成哪些音、出現在哪些句子
  const used = new Map(); // 字 → Map(讀音 → [句子])
  const unmarked = [];
  for (const { where, raw } of raws) {
    const marks = annotate(raw, zhuyin);
    [...raw].forEach((ch, i) => {
      if (!isHan(ch)) return;
      if (!marks[i]) { unmarked.push(`${where}｜${raw}｜${ch}`); return; }
      if (!used.has(ch)) used.set(ch, new Map());
      const byReading = used.get(ch);
      if (!byReading.has(marks[i])) byReading.set(marks[i], []);
      byReading.get(marks[i]).push(clause(raw, i));
    });
  }

  // 選的讀音不在辭典列的讀音裡／只靠異體字或通假才對得上
  const outside = [];
  const viaExtra = [];
  // 簡編只列一個讀音（現行標準），而選的不是它：不一定錯（古義、通假），但要人看過
  const offStandard = [];
  for (const [ch, byReading] of used) {
    const d = dict.get(ch);
    for (const [reading, at] of byReading) {
      const where = uniq(at).join('／');
      if (!d.all.includes(reading)) outside.push(`${ch} ${reading}（辭典：${d.own.join('、') || '無'}）｜${where}`);
      else if (!d.own.includes(reading)) viaExtra.push(`${ch} ${reading}｜${where}｜${d.extra.find((e) => e.syllable === reading).why}`);
      if (d.concised.length === 1 && reading !== d.concised[0]) offStandard.push(`${ch} 選 ${reading}，簡編只列 ${d.concised[0]}｜${where}`);
    }
  }

  // zhuyin.json 的分類和預設：chars 是單音字，poly 是破音字；poly 的預設讀音是辭典列的第一個讀音
  const misfiled = [
    ...Object.keys(zhuyin.chars || {}).filter((ch) => dict.has(ch) && dict.get(ch).all.length > 1).map((ch) => `${ch}：辭典有 ${dict.get(ch).all.join('、')}，應該放在 poly`),
    ...Object.keys(zhuyin.poly || {}).filter((ch) => dict.has(ch) && dict.get(ch).all.length <= 1).map((ch) => `${ch}：辭典只有一個讀音，應該放在 chars`),
  ];
  const notFirst = Object.entries(zhuyin.poly || {})
    .filter(([ch, reading]) => dict.has(ch) && dict.get(ch).first !== reading)
    .map(([ch, reading]) => `${ch}：poly 寫 ${reading}，辭典的第一個讀音是 ${dict.get(ch).first}`);

  // 簡編收的詞剛好出現在原文裡，而這裡標的讀音和那個詞條不同：列出來給人看。
  // 不一定是錯——同樣幾個字在文言裡可能是別的意思（「妻子」是妻和子），辭典的輕聲這裡也不標——所以只提醒，不算錯
  const wordDiff = [];
  const wordSame = new Map(); // 字 → 讀音和詞條一致的詞（旁證）
  for (const ch of poly) {
    for (const w of concisedWords(ch)) {
      for (const { raw } of raws) {
        const at = raw.indexOf(w.word);
        if (at === -1) continue;
        const mine = annotate(raw, zhuyin).slice(at, at + w.readings.length).join(' ');
        const theirs = w.readings.join(' ');
        if (mine === theirs) wordSame.set(ch, uniq([...(wordSame.get(ch) || []), `${w.word} ${theirs}`]));
        else wordDiff.push(`${w.word}：這裡標 ${mine}，簡編的詞條是 ${theirs}｜${raw.slice(Math.max(0, at - 6), at + w.word.length + 6)}`);
      }
    }
  }

  const show = (title, items) => { if (items.length) console.log(`${title}\n  ${uniq(items).join('\n  ')}`); };
  console.log(`全文 ${chars.length} 個不同的字；辭典列出兩個以上讀音的（破音字）有 ${poly.length} 個。`);
  if (noCache.length) console.log(`還沒查過辭典（先跑 fetch）：${noCache.join('')}`);
  if (notFound.length) console.log(`兩部辭典都查不到讀音：${notFound.join('')}`);
  show('辭典給的注音不是預期的寫法（解析可能有問題）：', odd);
  show('沒有標到音的字：', unmarked);
  show('選的讀音不在辭典列的讀音裡：', outside);
  show('chars／poly 放錯邊：', misfiled);
  show('poly 的預設讀音不是辭典列的第一個讀音：', notFirst);
  show('〔請人工確認〕選的讀音不在這個字底下，是依異體字或通假採用的：', viaExtra);
  show('〔請人工確認〕簡編只列一個讀音，而這裡選了別的：', offStandard);
  show('〔請人工確認〕和簡編收的詞讀音不同（同樣的字在文言裡可能是別的意思）：', wordDiff);

  if (list) {
    console.log('\n── 破音字清單（依在全文出現的順序）──');
    for (const ch of poly) {
      const d = dict.get(ch);
      console.log(`\n【${ch}】簡編：${d.concised.join('、') || '未收'}｜重編：${d.moe.map((r) => r.syllable).join('、') || '無'}${d.extra.length ? `｜另：${d.extra.map((e) => `${e.syllable}（${e.why}）`).join('、')}` : ''}`);
      for (const [reading, at] of used.get(ch) || []) console.log(`  選 ${reading}（${at.length} 處）：${at.join('／')}`);
      for (const r of d.moe) console.log(`    重編 ${r.syllable}　${r.defs.slice(0, 8).join(' ').slice(0, 220)}`);
      if (wordSame.has(ch)) console.log(`    簡編的詞條（讀音和這裡一致）：${wordSame.get(ch).join('；')}`);
    }
  }

  const bad = noCache.length + notFound.length + odd.length + unmarked.length + outside.length + misfiled.length + notFirst.length;
  console.log(bad ? '\n有需要處理的項目（見上）。' : '\n檢查通過：每個字都標到音，選的讀音都在辭典列的讀音裡。');
  return bad ? 1 : 0;
}

// ── 起底稿 ──
// 從辭典快取起一份 zhuyin.json 的底稿（新書開工時用一次，要先跑過 fetch）：
//   chars 是辭典只列一個讀音的字；poly 是破音字，先填辭典列的第一個讀音；
//   phrases 只留原本已經有、而且句子還在原文裡的那幾條。
// 之後的人工判斷（不讀第一個讀音的地方）都自己寫進 phrases；重跑 init 不會動到它們。
function init() {
  const raws = loadRaws();
  const old = existsSync(ZHUYIN) ? readJson(ZHUYIN) : {};
  const out = { chars: {}, poly: {}, phrases: {} };
  const missing = [];
  for (const ch of uniqueChars(raws)) {
    const d = lookup(ch);
    if (!d.first) { missing.push(ch); continue; }
    (d.all.length > 1 ? out.poly : out.chars)[ch] = d.first;
  }
  for (const [key, value] of Object.entries(old.phrases || {})) {
    if (raws.some((r) => r.raw.includes(key))) out.phrases[key] = value;
  }
  writeFileSync(ZHUYIN, `${JSON.stringify(out, null, 2)}\n`);
  console.log(`寫好 ${ZHUYIN}：單音字 ${Object.keys(out.chars).length}、破音字 ${Object.keys(out.poly).length}、詞句 ${Object.keys(out.phrases).length}。`);
  if (missing.length) console.log(`辭典查不到讀音、沒有寫進去的字：${missing.join('')}`);
  return missing.length ? 1 : 0;
}

const args = process.argv.slice(2);
if (args.includes('fetch')) {
  process.exitCode = (await fetchAll(uniqueChars(loadRaws()))) ? 1 : 0;
} else if (args.includes('init')) {
  process.exitCode = init();
} else {
  process.exitCode = check({ list: args.includes('--list') });
}
