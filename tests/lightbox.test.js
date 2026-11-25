// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { openLightbox, enableLightbox } from '../js/ui/lightbox.js';
import { artFigure } from '../js/ui/dom.js';
import { resetLayers, layerDepth, hasOpenLayer } from '../js/ui/layer.js';

const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  resetLayers();
  // happy-dom 的 history.back() 不會觸發 popstate，用 stub 模擬瀏覽器在下一輪送出
  vi.spyOn(window.history, 'back').mockImplementation(() => {
    setTimeout(() => window.dispatchEvent(new window.PopStateEvent('popstate', { state: null })), 0);
  });
});

// 一定要走真正的關閉路徑：lightbox.js 自己記著「現在開著哪一層」，只清 layer.js 的堆疊它不會知道
afterEach(async () => {
  const box = document.querySelector('#lightbox');
  if (box?.classList.contains('open')) box.click();
  resetLayers();
  await flush();
  vi.restoreAllMocks();
  document.body.textContent = '';
});

const lb = () => document.querySelector('#lightbox');
const isOpen = () => !!lb()?.classList.contains('open');
const esc = () => document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
function figure(file = 'c04-good-deeds.webp', alt = '鄉間小路') {
  const fig = artFigure(file, alt);
  document.body.appendChild(fig);
  return { fig, btn: fig.querySelector('.zoom-btn'), img: fig.querySelector('img') };
}

describe('插圖可以點開放大', () => {
  it('插圖包在一顆按鈕裡，鍵盤也按得到，名稱說得出這是放大哪張圖', () => {
    const { btn, img } = figure();
    expect(btn.tagName).toBe('BUTTON');
    expect(btn.type).toBe('button');
    expect(btn.getAttribute('aria-label')).toBe('放大圖片：鄉間小路');
    expect(btn.contains(img)).toBe(true);
    expect(img.alt).toBe('鄉間小路');
  });

  it('點圖開啟大圖，來源和說明文字與原圖相同', () => {
    const { btn, img } = figure();
    btn.click();
    expect(isOpen()).toBe(true);
    expect(hasOpenLayer()).toBe(true);
    expect(lb().querySelector('.lightbox-img').src).toBe(img.src);
    expect(lb().querySelector('.lightbox-img').alt).toBe('鄉間小路');
  });

  it('大圖是對話框，有關閉鈕和提示', () => {
    figure().btn.click();
    expect(lb().getAttribute('role')).toBe('dialog');
    expect(lb().getAttribute('aria-modal')).toBe('true');
    expect(lb().querySelector('.lightbox-close').getAttribute('aria-label')).toBe('關閉大圖');
    expect(lb().textContent).toContain('點任意處關閉');
  });

  it('點背景、點大圖本身、點 ✕、按 Esc、按返回鍵，都能關閉', async () => {
    const { btn } = figure();
    const ways = [
      () => lb().click(),
      () => lb().querySelector('.lightbox-img').click(),
      () => lb().querySelector('.lightbox-close').click(),
      () => esc(),
      () => window.dispatchEvent(new window.PopStateEvent('popstate', { state: null })),
    ];
    for (const close of ways) {
      btn.click();
      expect(isOpen()).toBe(true);
      close();
      expect(isOpen()).toBe(false);
      expect(layerDepth()).toBe(0);
      await flush(); await flush();
    }
  });

  it('已經開著時再開另一張：只換圖，不疊第二層', () => {
    document.body.style.overflow = 'scroll';
    figure().btn.click();
    openLightbox('assets/art/cover.webp', '封面');
    expect(layerDepth()).toBe(1);
    expect(lb().querySelector('.lightbox-img').getAttribute('src')).toBe('assets/art/cover.webp');
    expect(lb().querySelector('.lightbox-img').alt).toBe('封面');
    lb().click();
    expect(document.body.style.overflow).toBe('scroll'); // 原本的捲動設定沒有被蓋掉
    document.body.style.overflow = '';
  });

  it('關了再開，畫面上還是只有一個大圖疊層', async () => {
    const { btn } = figure();
    btn.click(); lb().click();
    await flush();
    btn.click();
    expect(document.querySelectorAll('#lightbox')).toHaveLength(1);
    expect(isOpen()).toBe(true);
  });

  it('開啟時鎖住背景捲動，關閉後還原', () => {
    document.body.style.overflow = 'scroll';
    const { btn } = figure();
    btn.click();
    expect(document.body.style.overflow).toBe('hidden');
    lb().click();
    expect(document.body.style.overflow).toBe('scroll');
    document.body.style.overflow = '';
  });

  it('開啟時焦點移到關閉鈕，關閉後回到原本那張圖', () => {
    const { btn } = figure();
    btn.focus();
    btn.click();
    expect(document.activeElement).toBe(lb().querySelector('.lightbox-close'));
    esc();
    expect(document.activeElement).toBe(btn);
  });

  it('於點擊當下才讀圖片來源（之後換過圖也對）', () => {
    const img = document.createElement('img');
    const btn = document.createElement('button');
    btn.appendChild(img);
    document.body.appendChild(btn);
    img.src = 'assets/art/a.webp';
    enableLightbox(btn, img);
    img.src = 'assets/art/b.webp';
    btn.click();
    expect(lb().querySelector('.lightbox-img').src).toBe(img.src);
  });

  it('頁面內容被整個換掉之後（疊層節點被移除），再點圖仍然開得起來', () => {
    figure().btn.click();
    lb().click();
    document.body.textContent = ''; // 疊層也一起被清掉了
    figure().btn.click();
    expect(document.querySelectorAll('#lightbox')).toHaveLength(1);
    expect(isOpen()).toBe(true);
  });

  it('artFigure 可以指定不要放大功能', () => {
    const fig = artFigure('land-fortune.webp', '山水人家', 'art-frame', { zoom: false });
    expect(fig.querySelector('.zoom-btn')).toBeNull();
    expect(fig.querySelector('img').alt).toBe('山水人家');
  });
});
