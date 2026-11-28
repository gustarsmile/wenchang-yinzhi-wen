export const BOOK_TITLE = '文昌帝君陰騭文';
// 頂列空間小，放短的書名
export const BOOK_SHORT_TITLE = '陰騭文';

// 部署定址：GitHub Pages（帳號 gustarsmile），自訂網域 edu.omilkyway.org 設定在 gustarsmile.github.io 那個 repo。
// 改這個值之後，index.html 的 og:url／og:image 也要一起改（tests/html.test.js 會守門）。
export const BOOK_URL = 'https://edu.omilkyway.org/wenchang-yinzhi-wen/';

// Google Analytics 4 的評估 ID（帳戶 OMILKYWAY.ORG、資源 wenchang-yinzhi-wen，2026-11-25 建立）。
// 這裡和 index.html 的 <head> 要一起改（tests/html.test.js 會檢查）；留空字串就代表沒裝，
// 這時 index.html 不能放 Google 代碼，「關於本書」也不會提到 GA。
export const GA_MEASUREMENT_ID = 'G-J1H4CXXMDT';

export const SAVE_KEY = 'yinzhiBook.v1';
export const DAILY_KEY = 'yinzhiDaily.v1';
export const PREFS_KEY = 'yinzhiPrefs.v1'; // 閱讀偏好（顯示注音），和進度分開存

// 全書 11 頁，一頁一段。《陰騭文》沒有傳統的分章，這 11 段是本書依內容分的。
export const PARTS = ['帝君自述', '四個典故', '心地福田', '人倫敬信', '濟急救危', '公平公益', '愛惜物命', '十勿', '修身處世', '修路造橋', '結語'];

// 各頁的種子數：一句一顆。第 2 頁是四個典故（一句一個故事），其餘是善行。合計 60 顆。
// 程式裡沿用《太上感應篇》那本的名字：資料的 role 叫 'lamps'、進度叫 lit／lightLamp，畫面上一律稱「種子」。
export const LAMP_COUNTS = [0, 4, 0, 0, 12, 8, 8, 10, 8, 10, 0];
export const TOTAL_LAMPS = 60;

// 「古今對照」配對遊戲接在第幾頁後面（修路造橋之後、結語之前）
export const MATCH_AFTER = 10;

// 「我的福田」頁用的整張大圖（不屬於任何一章）
export const LAND_ART = 'land-field.webp';
export const LAND_ALT = '豐收時節的福田全景：文昌帝君和兩個孩子站在開滿桃花的樹下，眼前是一格一格的田，有金黃的稻穗、粉紅與紫色的花田和結滿果子的果樹；小河上有石拱橋，遠處是瓦屋、青山和五彩祥雲';
export const COVER_ALT = '文昌帝君手持金色如意，站在五彩祥雲上微笑；下方開滿桃花的山坡上，小女孩捧著一株剛發芽的小苗，小男孩抱著書卷，一起仰頭望著帝君；天空是黎明的霞光，還亮著幾顆星';

// 正文底本資訊（顯示在封面與「關於本書」）
export const SOURCE = {
  byline: '道教勸善文・託名文昌帝君',
  chars: 636,
  base: '維基文庫《文昌帝君陰騭文》（通行本）',
  baseUrl: 'https://zh.wikisource.org/wiki/文昌帝君陰騭文',
  zhuguiUrl: 'https://zh.wikisource.org/wiki/陰隲文註',
};
