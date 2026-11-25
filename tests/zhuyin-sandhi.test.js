// 「一」「不」的變調，以及這本書人工判斷的幾處讀音（2026-11-25 定稿；書的主人還沒有逐條看過，
// 看過之後若有改動，這裡的期望值要跟著改，並在 README「注音」一節記下是誰、什麼時候定的）
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { annotate, applySandhi, annotateForDisplay } from '../js/zhuyin.js';

const zhuyin = JSON.parse(readFileSync(new URL('../js/data/zhuyin.json', import.meta.url), 'utf8'));
const chapters = JSON.parse(readFileSync(new URL('../js/data/chapters.json', import.meta.url), 'utf8'));
const allRaw = chapters.flatMap((c) => c.blocks.flatMap((b) => (b.type === 'list' ? b.items.map((i) => i.raw) : [b.raw])));

// 找出全書裡含有這幾個字的那一段，回傳這幾個字顯示時的讀音
function shown(phrase) {
  const raw = allRaw.find((r) => r.includes(phrase));
  expect(raw, `原文裡找不到「${phrase}」`).toBeTruthy();
  const at = [...raw].join('').indexOf(phrase);
  const offset = [...raw.slice(0, at)].length;
  return annotateForDisplay(raw, zhuyin).slice(offset, offset + [...phrase].length).join(' ');
}

describe('applySandhi：只改「一」「不」，照課本的標法', () => {
  it('「不」在四聲前面讀二聲，其他時候不變', () => {
    expect(applySandhi('不當', ['ㄅㄨˋ', 'ㄉㄤˋ'])).toEqual(['ㄅㄨˊ', 'ㄉㄤˋ']);
    expect(applySandhi('不欺', ['ㄅㄨˋ', 'ㄑㄧ'])).toEqual(['ㄅㄨˋ', 'ㄑㄧ']);
    expect(applySandhi('不仁', ['ㄅㄨˋ', 'ㄖㄣˊ'])).toEqual(['ㄅㄨˋ', 'ㄖㄣˊ']);
    expect(applySandhi('不履', ['ㄅㄨˋ', 'ㄌㄩˇ'])).toEqual(['ㄅㄨˋ', 'ㄌㄩˇ']);
  });

  it('「一」在四聲前面讀二聲，在一二三聲前面讀四聲', () => {
    expect(applySandhi('一日', ['ㄧ', 'ㄖˋ'])).toEqual(['ㄧˊ', 'ㄖˋ']);
    expect(applySandhi('一千', ['ㄧ', 'ㄑㄧㄢ'])).toEqual(['ㄧˋ', 'ㄑㄧㄢ']);
    expect(applySandhi('一年', ['ㄧ', 'ㄋㄧㄢˊ'])).toEqual(['ㄧˋ', 'ㄋㄧㄢˊ']);
    expect(applySandhi('一起', ['ㄧ', 'ㄑㄧˇ'])).toEqual(['ㄧˋ', 'ㄑㄧˇ']);
    expect(applySandhi('一百', ['ㄧ', 'ㄅㄞˇ'])).toEqual(['ㄧˋ', 'ㄅㄞˇ']);
  });

  it('「一十」的「一」是數字裡十位上的一，讀本調（和「一百」「一千」不同）', () => {
    expect(applySandhi('一十七世', ['ㄧ', 'ㄕˊ', 'ㄑㄧ', 'ㄕˋ'])).toEqual(['ㄧ', 'ㄕˊ', 'ㄑㄧ', 'ㄕˋ']);
    expect(applySandhi('一十', ['ㄧ', 'ㄕˊ'])).toEqual(['ㄧ', 'ㄕˊ']);
    // 例外只認「十」這個字，不是認二聲：別的二聲字前面照樣變調
    expect(applySandhi('一時', ['ㄧ', 'ㄕˊ'])).toEqual(['ㄧˋ', 'ㄕˊ']);
  });

  it('後面不是字（標點、句尾）就讀本調；不會動到別的字，也不會改到傳進來的陣列', () => {
    expect(applySandhi('不，當', ['ㄅㄨˋ', null, 'ㄉㄤˋ'])).toEqual(['ㄅㄨˋ', null, 'ㄉㄤˋ']);
    expect(applySandhi('一', ['ㄧ'])).toEqual(['ㄧ']);
    expect(applySandhi('第一', ['ㄉㄧˋ', 'ㄧ'])).toEqual(['ㄉㄧˋ', 'ㄧ']);
    const base = ['ㄅㄨˋ', 'ㄉㄤˋ'];
    applySandhi('不當', base);
    expect(base).toEqual(['ㄅㄨˋ', 'ㄉㄤˋ']);
  });

  it('連續兩個字都要變的時候，看的是後一個字的本調', () => {
    expect(applySandhi('一不', ['ㄧ', 'ㄅㄨˋ'])).toEqual(['ㄧˊ', 'ㄅㄨˋ']);
  });
});

describe('書裡實際顯示的讀音', () => {
  it('annotate 仍然回傳本調（資料和辭典查證用），顯示用的才變調', () => {
    const raw = allRaw.find((r) => r.includes('父子不睦'));
    expect(annotate(raw, zhuyin)).toContain('ㄅㄨˋ');
    expect(annotateForDisplay(raw, zhuyin)).not.toContain('ㄅㄨˋ');
    expect(annotateForDisplay(raw, zhuyin)).toHaveLength([...raw].length);
  });

  it('「不」照變調顯示：四聲前面讀二聲，其餘讀本調', () => {
    expect(shown('父子不睦')).toBe('ㄈㄨˋ ㄗˇ ㄅㄨˊ ㄇㄨˋ');
    expect(shown('兄弟不和')).toBe('ㄒㄩㄥ ㄉㄧˋ ㄅㄨˋ ㄏㄜˊ');
    expect(shown('不可輕出重入')).toBe('ㄅㄨˋ ㄎㄜˇ ㄑㄧㄥ ㄔㄨ ㄓㄨㄥˋ ㄖㄨˋ');
    expect(shown('不可口是心非')).toBe('ㄅㄨˋ ㄎㄜˇ ㄎㄡˇ ㄕˋ ㄒㄧㄣ ㄈㄟ');
    expect(shown('豈不從')).toBe('ㄑㄧˇ ㄅㄨˋ ㄘㄨㄥˊ');
  });

  it('全書唯一的「一」：一十七世，讀本調', () => {
    expect(allRaw.join('').split('一').length - 1).toBe(1);
    expect(shown('一十七世')).toBe('ㄧ ㄕˊ ㄑㄧ ㄕˋ');
  });

  it('十處人工判斷（不讀辭典列的第一個讀音）', () => {
    expect(shown('救人之難')).toBe('ㄐㄧㄡˋ ㄖㄣˊ ㄓ ㄋㄢˋ');
    expect(shown('中狀元')).toBe('ㄓㄨㄥˋ ㄓㄨㄤˋ ㄩㄢˊ');
    expect(shown('宰相')).toBe('ㄗㄞˇ ㄒㄧㄤˋ');
    expect(shown('為國救民')).toBe('ㄨㄟˋ ㄍㄨㄛˊ ㄐㄧㄡˋ ㄇㄧㄣˊ');
    expect(shown('大量')).toBe('ㄉㄚˋ ㄌㄧㄤˋ');
    expect(shown('師長')).toBe('ㄕ ㄓㄤˇ');
    expect(shown('朝斗')).toBe('ㄔㄠˊ ㄉㄡˇ');
    expect(shown('暴露')).toBe('ㄆㄨˋ ㄌㄨˋ'); // 兩部辭典的詞條都是這個讀音
    expect(shown('本分')).toBe('ㄅㄣˇ ㄈㄣˋ');
    expect(shown('德行')).toBe('ㄉㄜˊ ㄒㄧㄥˋ');
    expect(Object.keys(zhuyin.phrases)).toHaveLength(10);
  });

  it('照第一個讀音、但容易想成別的音的幾處', () => {
    expect(shown('遠避之')).toBe('ㄩㄢˇ ㄅㄧˋ ㄓ'); // 「遠遠地避開」，不是當動詞的ㄩㄢˋ
    expect(shown('當途')).toBe('ㄉㄤ ㄊㄨˊ'); // 和「當道」的當一樣
    expect(shown('錫汝以福')).toBe('ㄒㄧˊ ㄖㄨˇ ㄧˇ ㄈㄨˊ'); // 通「賜」，照本字讀
    expect(shown('士大夫')).toBe('ㄕˋ ㄉㄚˋ ㄈㄨ'); // 不是醫生的ㄉㄞˋ ㄈㄨ
    expect(shown('兄弟')).toBe('ㄒㄩㄥ ㄉㄧˋ'); // 文言不標輕聲
    expect(shown('規矩')).toBe('ㄍㄨㄟ ㄐㄩˇ');
  });
});
