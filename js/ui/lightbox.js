// 點圖放大：全螢幕看完整的插圖（版面上的圖是裁切過的），再點一下還原。
// 做法比照《天堂遊記》：全書共用單一疊層，第一次點圖時才建立；
// 點任意處、✕、Esc、手機返回鍵都能關（後三者由 layer.js 統一處理）。
import { pushLayer } from './layer.js';

let overlay = null;
let bigImg = null;
let closeBtn = null;
let layer = null;

function ensureOverlay(doc) {
  if (overlay) {
    // 頁面內容被整個換掉時，疊層節點會跟著被移除；掛回去就能繼續用
    if (!overlay.isConnected) doc.body.appendChild(overlay);
    return;
  }
  overlay = doc.createElement('div');
  overlay.id = 'lightbox';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', '放大的插圖');

  bigImg = doc.createElement('img');
  bigImg.className = 'lightbox-img';
  bigImg.decoding = 'async';
  overlay.appendChild(bigImg);

  closeBtn = doc.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'lightbox-close';
  closeBtn.textContent = '✕';
  closeBtn.setAttribute('aria-label', '關閉大圖');
  overlay.appendChild(closeBtn);

  const hint = doc.createElement('p');
  hint.className = 'lightbox-hint';
  hint.textContent = '點任意處關閉';
  overlay.appendChild(hint);

  // 不檢查 e.target：點背景、點大圖、點 ✕ 都冒泡到這裡，一律關閉
  overlay.addEventListener('click', () => layer?.close());

  doc.body.appendChild(overlay);
}

// trigger：關閉後要把焦點還給誰（用鍵盤開的人才不會迷路）
export function openLightbox(src, alt = '', doc = document, trigger = null) {
  ensureOverlay(doc);
  bigImg.src = src;
  bigImg.alt = alt;
  // 已開啟時只換圖：重複推疊層會讓原本的捲動設定被 'hidden' 蓋掉而還原不回來，
  // 也會在 layer.js 的堆疊裡留下沒人關的殘層
  if (layer) return;
  overlay.classList.add('open');
  // 用區域變數記住「這一次」開啟前的狀態，不受之後的開啟影響
  const prevOverflow = doc.body.style.overflow;
  doc.body.style.overflow = 'hidden';
  // 後面的頁面整個設成 inert：Tab 跑不到後面、螢幕閱讀器也只唸大圖。
  // 只動原本不是 inert 的，關閉時才不會把別人設的也解開
  const behind = [...doc.body.children].filter((n) => n !== overlay && !n.inert);
  for (const n of behind) n.inert = true;
  layer = pushLayer(() => {
    overlay.classList.remove('open');
    doc.body.style.overflow = prevOverflow;
    for (const n of behind) n.inert = false; // 先解開，下面才把焦點還得回去
    layer = null;
    if (trigger?.isConnected) trigger.focus({ preventScroll: true });
  }, doc);
  closeBtn.focus({ preventScroll: true });
}

// 把 trigger（包著圖的按鈕）接上放大功能
export function enableLightbox(trigger, img, doc = document) {
  // 點擊當下才讀來源：圖片之後換過 src（例如備援圖）也會指向正確的那張
  trigger.addEventListener('click', () => openLightbox(img.currentSrc || img.src, img.alt, doc, trigger));
}
