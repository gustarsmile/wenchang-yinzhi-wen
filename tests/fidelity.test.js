import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { loadBookFromDisk } from './helpers/loadBook.js';
import { chapterRaw } from '../js/book.js';
import { SOURCE } from '../js/config.js';

const squeeze = (s) => s.replace(/\s+/g, '');
// 底本一：本書採用的通行本全文，含本書加的新式標點與分段；一行是一頁
const fixture = readFileSync('tests/fixtures/yinzhi-wen.txt', 'utf8');
const punctuated = squeeze(fixture);
const fixturePages = fixture.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
// 底本二：維基文庫《文昌帝君陰騭文》的正文，只有字、沒有標點
const wikisource = squeeze(readFileSync('tests/fixtures/yinzhi-wen-wikisource-bare.txt', 'utf8'));

const PUNCTUATION = /[，。；：、！？「」『』…\s]/g;

function rawOf(chapters) {
  let out = '';
  for (const ch of chapters) {
    for (const b of ch.blocks) {
      if (b.type === 'passage') out += b.raw;
      else if (b.type === 'list') for (const it of b.items) out += it.raw;
    }
  }
  return out.replace(/\s+/g, '');
}

// 兩段文字不一樣時，指出第幾個字開始不同（比一整串幾百字的 diff 好讀）
function expectSameText(mine, base) {
  if (mine !== base) {
    let i = 0;
    while (i < mine.length && i < base.length && mine[i] === base[i]) i += 1;
    const ctx = (s) => `${s.slice(Math.max(0, i - 20), i)}【${s.slice(i, i + 1)}】${s.slice(i + 1, i + 20)}`;
    throw new Error(`第 ${i} 個字開始不同\n  底本：${ctx(base)}\n  本書：${ctx(mine)}\n  長度 底本 ${base.length}／本書 ${mine.length}`);
  }
  expect(mine).toBe(base);
}

describe('原文逐字比對', () => {
  const { chapters } = loadBookFromDisk();
  const mine = rawOf(chapters);
  const bare = mine.replace(PUNCTUATION, '');

  it('所有頁的原文串起來，和底本一字不差（含標點）', () => {
    expectSameText(mine, punctuated);
  });

  it('分頁也和底本一樣：底本一行一頁，共 11 行，每一頁的原文就是那一行', () => {
    expect(fixturePages).toHaveLength(11);
    expect(chapters).toHaveLength(fixturePages.length);
    chapters.forEach((ch, i) => {
      if (chapterRaw(ch) !== fixturePages[i]) throw new Error(`第 ${ch.no} 頁和底本的第 ${i + 1} 行不同\n  底本：${fixturePages[i]}\n  本書：${chapterRaw(ch)}`);
    });
  });

  it('去掉標點後正好 636 個漢字（封面和「關於本書」寫的字數）', () => {
    expect(bare).toMatch(/^[㐀-鿿]+$/); // 只剩漢字：沒有清單以外的標點混在裡面
    expect([...bare]).toHaveLength(636);
    expect(SOURCE.chars).toBe(636);
  });

  it('去掉標點後，和維基文庫的正文逐字相同（一個字都沒有換，沒有任何異體字替換）', () => {
    expect([...wikisource]).toHaveLength(636);
    expectSameText(bare, wikisource);
  });

  // 這篇文字流傳的本子用字略有出入（「關於本書」有說明）；本書一律從通行本，下面幾處釘住，不要照別的本子改
  it.each([
    ['毋侮聖言', '毋侮聖賢'],
    ['捐貲以成人美', '捐資以成人美'],
    ['勿壞人之名利', '勿壞人之名節'],
    ['諧和宗族', '和諧宗族'],
    ['天必錫汝以福', '天必賜汝以福'],
    ['勿登山而網禽鳥', '勿登山而網禽獸'],
  ])('從通行本：是「%s」，不是「%s」', (ours, other) => {
    expect(mine).toContain(ours);
    expect(mine).not.toContain(other);
  });
});
