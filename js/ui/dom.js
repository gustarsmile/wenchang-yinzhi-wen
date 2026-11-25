// 建立 DOM 的小工具。全書不用 innerHTML 塞資料，文字一律走 textContent。
import { enableLightbox } from './lightbox.js';

export function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

export function button(label, className, onClick, action) {
  const b = el('button', className, label);
  b.type = 'button';
  if (action) b.dataset.action = action;
  if (onClick) b.addEventListener('click', onClick);
  return b;
}

export function append(parent, ...children) {
  for (const c of children) if (c) parent.appendChild(c);
  return parent;
}

// 插圖：CSS 先用 aspect-ratio 佔好位置；圖載不到時整個框收起來，不留破圖。
// 預設可以點開放大：圖包在一顆 <button> 裡，滑鼠、觸控、鍵盤都開得了。
export function artFigure(file, alt, className = 'art-frame', { zoom = true } = {}) {
  const fig = el('figure', className);
  const img = el('img');
  img.src = `assets/art/${file}`;
  img.alt = alt;
  img.decoding = 'async';
  img.addEventListener('error', () => fig.classList.add('art-missing'));
  if (!zoom) {
    fig.appendChild(img);
    return fig;
  }
  const btn = el('button', 'zoom-btn');
  btn.type = 'button';
  btn.setAttribute('aria-label', `放大圖片：${alt}`);
  btn.appendChild(img);
  enableLightbox(btn, img);
  fig.appendChild(btn);
  return fig;
}

const CN = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
// 1–99 的中文數字（章次用）
export function cnNumber(n) {
  if (n <= 10) return CN[n];
  const tens = Math.floor(n / 10);
  const ones = n % 10;
  return `${tens > 1 ? CN[tens] : ''}十${ones ? CN[ones] : ''}`;
}
