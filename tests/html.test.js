import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { BOOK_URL, GA_MEASUREMENT_ID } from '../js/config.js';

const html = readFileSync('index.html', 'utf8');
const meta = (attr, key) => new RegExp(`<meta ${attr}="${key}" content="([^"]*)"`).exec(html)?.[1];
// 外部資源：<script>／<link> 裡用完整網址載入的東西
const external = [...html.matchAll(/<(?:script|link)[^>]+(?:src|href)="(https?:[^"]+)"/g)].map((m) => m[1]);

describe('index.html', () => {
  it('語言標成繁體中文、有 viewport', () => {
    expect(html).toMatch(/<html lang="zh-Hant">/);
    expect(meta('name', 'viewport')).toContain('width=device-width');
  });
  it('有標題、描述、theme-color', () => {
    expect(html).toMatch(/<title>文昌帝君陰騭文[^<]*<\/title>/);
    expect(meta('name', 'description').length).toBeGreaterThan(40);
    expect(meta('name', 'theme-color')).toBe('#6a1f15');
  });
  it('favicon 連結存在，檔案也存在', () => {
    expect(html).toMatch(/rel="icon"[^>]*href="assets\/favicon\.svg"/);
    expect(existsSync('assets/favicon.svg')).toBe(true);
  });
  it('og:url、og:image 和 BOOK_URL 一致（改網址時兩邊要一起改）', () => {
    expect(BOOK_URL).toMatch(/^https:\/\/.+\/$/);
    expect(meta('property', 'og:url')).toBe(BOOK_URL);
    expect(meta('property', 'og:image')).toBe(`${BOOK_URL}assets/og.png`);
    expect(meta('property', 'og:title')).toBeTruthy();
    expect(meta('property', 'og:description')).toBeTruthy();
  });
  it('資源都用相對路徑（放在 GitHub Pages 的子目錄下才載得到）', () => {
    const refs = [...html.matchAll(/(?:href|src)="([^"]+)"/g)].map((m) => m[1]);
    for (const r of refs) expect(r.startsWith('/'), r).toBe(false);
    for (const r of refs.filter((x) => !x.startsWith('http'))) expect(existsSync(r), r).toBe(true);
  });
});

// Google Analytics 還沒裝的時候，config.js 的 GA_MEASUREMENT_ID 是空字串，index.html 不放任何 Google 代碼；
// 裝了之後，ID 和 <head> 裡的代碼要一起改。兩種情況要守的東西不一樣，依 GA_MEASUREMENT_ID 分兩邊。
describe('index.html 的 Google Analytics', () => {
  if (GA_MEASUREMENT_ID === '') {
    it('還沒裝 GA：沒有任何外部資源（沒有第三方腳本、字型）', () => {
      expect(external).toEqual([]);
    });
    it('還沒裝 GA：頁面裡沒有 Google 代碼，也沒有任何 G- 開頭的評估 ID', () => {
      expect(html).not.toMatch(/G-[A-Z0-9]{8,12}/);
      expect(html).not.toContain('googletagmanager');
      expect(html).not.toContain('gtag(');
      expect(html).not.toContain('dataLayer');
    });
  } else {
    it('外部資源只有 Google Analytics 的 Google 代碼一個（沒有其他第三方腳本、字型）', () => {
      expect(external).toEqual([`https://www.googletagmanager.com/gtm.js?id=${GA_MEASUREMENT_ID}`]);
    });
    it('Google 代碼：照 GA 後台給的寫法，ID 和 config.js 一致、非同步載入、放在 <head>', () => {
      expect(GA_MEASUREMENT_ID).toMatch(/^G-[A-Z0-9]{8,12}$/);
      const head = html.slice(0, html.indexOf('</head>'));
      expect(head).toContain(`<script async src="https://www.googletagmanager.com/gtm.js?id=${GA_MEASUREMENT_ID}"></script>`);
      expect(head).toContain('window.dataLayer = window.dataLayer || [];');
      expect(head).toContain("gtag('js', new Date());");
      // 整份頁面只出現這一個評估 ID（換 ID 時不會漏改）
      expect([...new Set(html.match(/G-[A-Z0-9]{8,12}/g))]).toEqual([GA_MEASUREMENT_ID]);
    });
  }
});
