import { describe, it, expect } from 'vitest';
import { loadBookFromDisk } from './helpers/loadBook.js';
import { LAMP_COUNTS, TOTAL_LAMPS, PARTS } from '../js/config.js';
import { ART_MANIFEST } from '../scripts/art-manifest.mjs';

const { chapters, glossary, daily, match } = loadBookFromDisk();
// 種子清單。程式和資料裡沿用《太上感應篇》那本的名字（role: 'lamps'），畫面上一律稱「種子」
const lampsOf = (ch) => ch.blocks.find((b) => b.type === 'list' && b.role === 'lamps');
const textBlocks = (ch) => ch.blocks.flatMap((b) => (b.type === 'list' ? b.items : [b]));
const rawOf = (ch) => textBlocks(ch).map((t) => t.raw).join('');
const page = (no) => chapters[no - 1];
const bare = (s) => s.replace(/[，。；：、！？「」『』…\s]/g, '');
// 頁的類型 → 那一頁種子清單的性質（tone）；不在這裡的類型沒有清單
const TONE_OF_KIND = { stories: 'story', deeds: 'good', guard: 'guard' };

describe('章節結構', () => {
  it('11 頁，編號與 id 連續', () => {
    expect(chapters).toHaveLength(11);
    chapters.forEach((ch, i) => {
      expect(ch.no).toBe(i + 1);
      expect(ch.id).toBe(`ch${String(i + 1).padStart(2, '0')}`);
      expect(ch.title, ch.id).toBeTruthy();
      expect(ch.subtitle, ch.id).toBeTruthy();
      expect(ch.art, ch.id).toMatch(/\.webp$/);
      expect(ch.alt, ch.id).toBeTruthy();
    });
  });

  it('頁的類型依序是 intro、stories、text×2、deeds×3、guard、deeds×2、end', () => {
    expect(chapters.map((c) => c.kind)).toEqual(
      ['intro', 'stories', 'text', 'text', 'deeds', 'deeds', 'deeds', 'guard', 'deeds', 'deeds', 'end'],
    );
  });

  it('十一段：一頁一段（part 就是頁次），頁名和 config 的 PARTS 一致', () => {
    expect(PARTS).toHaveLength(11);
    expect(new Set(PARTS).size).toBe(11);
    expect(chapters.map((c) => c.part)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    for (const ch of chapters) {
      expect(ch.part, ch.id).toBe(ch.no);
      expect(ch.title, ch.id).toBe(PARTS[ch.part - 1]);
    }
  });

  it('沒有分成幾頁的段：資料裡不再有 seq、partName', () => {
    for (const ch of chapters) {
      expect(ch.seq, ch.id).toBeUndefined();
      expect(ch.partName, ch.id).toBeUndefined();
    }
  });

  it('區塊只有兩種：段落（passage）和種子的清單（list／lamps）；沒有別種清單，也沒有 virtue 欄位', () => {
    for (const ch of chapters) {
      expect(ch.blocks.length, ch.id).toBeGreaterThan(0);
      for (const b of ch.blocks) {
        expect(['passage', 'list'], ch.id).toContain(b.type);
        if (b.type === 'list') expect(b.role, ch.id).toBe('lamps');
      }
      expect(ch.blocks.filter((b) => b.type === 'list').length, ch.id).toBeLessThanOrEqual(1);
      expect(ch.virtue, ch.id).toBeUndefined();
    }
  });

  it('每一段原文都有白話', () => {
    for (const ch of chapters) {
      for (const t of textBlocks(ch)) {
        expect(t.raw, ch.id).toBeTruthy();
        expect(t.plain, `${ch.id}｜${t.raw}`).toBeTruthy();
      }
    }
  });
});

describe('種子的清單', () => {
  it('只有第 2、5、6、7、8、9、10 頁有種子：4、12、8、8、10、8、10 顆，合計 60', () => {
    const counts = chapters.map((c) => lampsOf(c)?.items.length ?? 0);
    expect(counts).toEqual([0, 4, 0, 0, 12, 8, 8, 10, 8, 10, 0]);
    expect(counts).toEqual(LAMP_COUNTS);
    expect(counts.reduce((a, b) => a + b, 0)).toBe(TOTAL_LAMPS);
    expect(TOTAL_LAMPS).toBe(60);
    expect(chapters.filter((c) => lampsOf(c)).map((c) => c.no)).toEqual([2, 5, 6, 7, 8, 9, 10]);
  });

  it('清單有名目與說明；性質（tone）跟著頁的類型：典故是 story、善行是 good、〈十勿〉是 guard', () => {
    for (const c of chapters) {
      const list = lampsOf(c);
      expect(Boolean(list), c.id).toBe(c.kind in TONE_OF_KIND);
      if (!list) continue;
      expect(list.name, c.id).toBeTruthy();
      expect(list.nameNote, c.id).toBeTruthy();
      expect(list.tone, c.id).toBe(TONE_OF_KIND[c.kind]);
    }
    // 三種性質都用到了；已經沒有《太上感應篇》那本的 evil
    expect([...new Set(chapters.map((c) => lampsOf(c)?.tone).filter(Boolean))].sort()).toEqual(['good', 'guard', 'story']);
  });

  it('超過 12 列的清單一定要分組；分了組的清單，每一列都有 group，而且同一組的列相鄰', () => {
    const noGroup = [];
    const split = [];
    let grouped = 0;
    for (const c of chapters) {
      const list = lampsOf(c);
      if (!list) continue;
      const hasGroups = list.items.some((it) => it.group);
      if (list.items.length <= 12 && !hasGroups) continue;
      grouped += 1;
      const seen = new Set();
      let prev = null;
      for (const it of list.items) {
        if (!it.group) { noGroup.push(`${c.id}｜${it.raw}`); continue; }
        if (it.group !== prev) {
          if (seen.has(it.group)) split.push(`${c.id}｜${it.group}`);
          seen.add(it.group);
          prev = it.group;
        }
      }
    }
    expect(noGroup, '沒有 group 的列').toEqual([]);
    expect(split, '被拆成不相鄰兩段的組').toEqual([]);
    expect(grouped, '書裡至少有一頁的清單分了組（不然這條檢查等於沒檢查）').toBeGreaterThan(0);
  });

  it('帶著古代社會背景的句子都附有說明（「關於本書」說：照原文翻譯，並在旁邊註明背景）', () => {
    // 「關於本書」舉的四個例子：忠於君主、家裡的奴僕、敬惜字紙、不殺耕牛。後三個是清單裡的列，說明寫在 note
    const rows = chapters.flatMap((c) => lampsOf(c)?.items ?? []);
    const sensitive = ['奴僕待之寬恕', '勿宰耕牛', '勿棄字紙'];
    for (const s of sensitive) expect(rows.some((r) => r.raw.includes(s)), `原文裡找不到「${s}」`).toBe(true);
    expect(sensitive.filter((s) => !rows.find((r) => r.raw.includes(s)).note), '沒有說明的句子').toEqual([]);
    // 「忠主」在段落裡（段落沒有 note），背景寫在它的難詞註解裡：要交代原本指的是君主
    const loyal = chapters.flatMap(textBlocks).find((t) => t.raw.includes('忠主'));
    expect(loyal, '原文裡找不到「忠主」').toBeTruthy();
    const entry = (loyal.terms || []).map((key) => glossary[key]).find((e) => e?.term === '忠主');
    expect(entry, '「忠主」沒有註解').toBeTruthy();
    expect(entry.note).toContain('君主');
  });
});

describe('典故的故事', () => {
  const FIELDS = ['title', 'who', 'text', 'source', 'art', 'alt'];
  const stories = lampsOf(page(2)).items.map((it) => it.story);

  it('第 2 頁〈四個典故〉的四列各附一則故事，六個欄位都有（標題、人物、故事、出處、插圖、插圖說明）', () => {
    expect(page(2).kind).toBe('stories');
    expect(stories).toHaveLength(4);
    lampsOf(page(2)).items.forEach((it, i) => {
      expect(it.story, `第 ${i + 1} 列沒有故事`).toBeTruthy();
      expect(Object.keys(it.story).sort(), `第 ${i + 1} 列`).toEqual([...FIELDS].sort());
      for (const field of FIELDS) {
        expect(typeof it.story[field] === 'string' && it.story[field].trim().length > 0, `第 ${i + 1} 列的 story.${field}`).toBe(true);
      }
    });
  });

  it('只有第 2 頁有故事，其他頁的列都沒有', () => {
    const others = chapters.filter((c) => c.no !== 2).flatMap((c) => (lampsOf(c)?.items ?? []).filter((it) => it.story).map((it) => `${c.id}｜${it.raw}`));
    expect(others).toEqual([]);
  });

  it('故事的插圖都在插圖清單裡，四張各不相同，也不和各頁的插圖共用', () => {
    const arts = stories.map((s) => s.art);
    for (const f of arts) {
      expect(f).toMatch(/\.webp$/);
      expect(ART_MANIFEST, f).toContain(f);
      expect(chapters.map((c) => c.art), f).not.toContain(f);
    }
    expect(new Set(arts).size).toBe(4);
  });
});

describe('導讀、情境題、帶走的一句話', () => {
  it('每一頁都有副題、導讀、插圖說明和一句帶走的話', () => {
    const missing = [];
    for (const c of chapters) {
      for (const field of ['subtitle', 'lead', 'alt', 'takeaway']) {
        if (typeof c[field] !== 'string' || !c[field].trim()) missing.push(`${c.id}.${field}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('每一頁一題情境題：三個選項，各有選項文字與回饋', () => {
    const bad = [];
    for (const c of chapters) {
      const s = c.scenario;
      const ok = s && s.prompt && Array.isArray(s.options) && s.options.length === 3 && s.options.every((o) => o.text && o.reply);
      if (!ok) bad.push(c.id);
    }
    expect(bad, '情境題不完整的頁').toEqual([]);
  });
});

describe('白話的用詞', () => {
  it('原文的「常」是「總是、一再」，白話不寫成「常常」', () => {
    const blocks = chapters.flatMap(textBlocks).filter((t) => t.raw.includes('常'));
    expect(blocks.length, '原文裡有「常」的句子').toBeGreaterThan(0);
    expect(blocks.filter((t) => t.plain.includes('常常')).map((t) => `${t.raw}｜${t.plain}`)).toEqual([]);
  });
});

describe('註解', () => {
  it('每個詞條都有 term 與 note', () => {
    expect(Object.keys(glossary).length).toBeGreaterThan(0);
    for (const [key, entry] of Object.entries(glossary)) {
      expect(entry.term, key).toBeTruthy();
      expect(entry.note, key).toBeTruthy();
    }
  });

  it('區塊引用的詞條都存在，而且那個詞真的出現在該段原文裡', () => {
    for (const ch of chapters) {
      for (const t of textBlocks(ch)) {
        for (const key of t.terms || []) {
          expect(glossary[key], `${ch.id} 引用了不存在的詞條「${key}」`).toBeTruthy();
          expect(t.raw, `${ch.id}｜詞條「${key}」不在這段原文裡`).toContain(glossary[key].term);
        }
      }
    }
  });

  it('每個詞條至少被引用一次（沒有孤兒詞條）', () => {
    const used = new Set(chapters.flatMap((ch) => textBlocks(ch).flatMap((t) => t.terms || [])));
    for (const key of Object.keys(glossary)) expect(used.has(key), `詞條「${key}」沒有被用到`).toBe(true);
  });
});

describe('時時方便', () => {
  it('三項，各有名稱與一句提問：利人、利物、陰功（都是第 3 頁〈心地福田〉原文裡的詞）', () => {
    expect(daily.items).toHaveLength(3);
    expect(daily.items.map((it) => it.name)).toEqual(['利人', '利物', '陰功']);
    expect(rawOf(page(3))).toContain('作種種之陰功。利物利人');
    daily.items.forEach((it, i) => {
      expect(rawOf(page(3)), it.name).toContain(it.name);
      expect(it.ask, `第 ${i + 1} 項`).toBeTruthy();
    });
  });

  it('有引文、導言、三種結語和「累積」的說明', () => {
    for (const text of [daily.quote, daily.intro, daily.closing.none, daily.closing.some, daily.closing.all, daily.totalNote]) {
      expect(typeof text === 'string' && text.trim().length > 0).toBe(true);
    }
  });

  it('引文是原文裡的句子', () => {
    // 句尾那一個標點可以不同（單獨引出來時收成句號）；其餘連標點都要和原文一樣
    const core = daily.quote.replace(/[，。；：、！？]$/, '');
    expect(core.length).toBeGreaterThan(10);
    expect(chapters.map(rawOf).join('')).toContain(core);
  });
});

describe('古今對照', () => {
  it('八組，id 不重複；每組有原文、白話和今天的例子，另有開頭與完成時的說明', () => {
    expect(match.pairs).toHaveLength(8);
    expect(new Set(match.pairs.map((p) => p.id)).size).toBe(8);
    for (const p of match.pairs) {
      expect(p.id, JSON.stringify(p)).toBeTruthy();
      for (const field of ['raw', 'plain', 'now']) expect(p[field], `${p.id}.${field}`).toBeTruthy();
    }
    // 同一句不能出現在兩組裡（不然配對的時候有兩個「對」的答案）
    expect(new Set(match.pairs.map((p) => p.raw)).size).toBe(8);
    expect(new Set(match.pairs.map((p) => p.now)).size).toBe(8);
    expect(match.lead).toBeTruthy();
    expect(match.done).toBeTruthy();
  });

  it('每一組的原文（raw）都是書裡原文的句子（去掉標點後比對）', () => {
    const all = bare(chapters.map(rawOf).join(''));
    for (const p of match.pairs) {
      expect(bare(p.raw), `${p.id}｜${p.raw}`).toMatch(/^[㐀-鿿]{2,}$/); // 去掉標點後只剩漢字，而且不是空的
      expect(all, `${p.id}｜${p.raw}`).toContain(bare(p.raw));
    }
  });
});

describe('稿子寫完了沒', () => {
  it('全書的白話、導讀、註解都不可以出現「（撰寫中）」', () => {
    const todo = chapters.filter((c) => JSON.stringify(c).includes('撰寫中')).map((c) => c.id);
    expect(todo, '還有「撰寫中」的頁').toEqual([]);
    for (const [name, data] of Object.entries({ glossary, daily, match })) {
      expect(JSON.stringify(data), `${name}.json`).not.toContain('撰寫中');
    }
  });
});
