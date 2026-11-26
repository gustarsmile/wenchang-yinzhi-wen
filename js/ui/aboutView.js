import { el, button, append } from './dom.js';
import { SOURCE, GA_MEASUREMENT_ID, TOTAL_LAMPS } from '../config.js';

function link(text, href) {
  const a = el('a', null, text);
  a.href = href;
  a.target = '_blank';
  a.rel = 'noopener';
  return a;
}

function section(title, ...children) {
  return append(el('section', 'about-sec'), el('h2', null, title), ...children);
}

function linkList(items) {
  const ul = el('ul', 'about-links');
  for (const [text, href] of items) ul.appendChild(append(el('li'), link(text, href)));
  return ul;
}

export function renderAbout(root, ctx) {
  const { store, go } = ctx;
  const page = el('section', 'page about');
  append(page, el('p', 'ch-kicker', '版權頁'), el('h1', null, '關於本書'));

  page.appendChild(section(
    '這是一篇什麼文字',
    el('p', null, '《文昌帝君陰騭文》簡稱《陰騭文》，是以文昌帝君的名義流傳的勸善文，作者不詳，成書年代有宋、元、明幾種說法。它和《太上感應篇》《關聖帝君覺世真經》常被合稱為「三聖經」，是華人社會流通最廣的幾部善書；清代的朱珪、周安士等人都為它作過註解。'),
    el('p', null, '「陰騭」讀作ㄧㄣ ㄓˋ，指默默行善、不求人知。全篇從帝君的自述說起，舉了四個古人的故事，接著一條一條列出做得到的善行，最後歸結到「諸惡莫作，眾善奉行」。'),
  ));

  page.appendChild(section(
    '原文',
    el('p', null, `本書的原文採通行本，共 ${SOURCE.chars.toLocaleString('en-US')} 字，和維基文庫所收的《文昌帝君陰騭文》逐字相同。全書測試會把書裡所有原文串起來，和底本逐字比對。`),
    el('p', null, '新式標點和分段是本書加的，全篇不加引號。《陰騭文》沒有傳統的分章，書裡的十一段是本書依內容分的。'),
    el('p', null, '這篇文字流傳的本子長短不一。清代朱珪《陰隲文註》、周安士《文昌帝君陰騭文廣義節錄》所註的本子比較短，大約五百四十四字，沒有通行本裡的這七處：「存平等心，擴寬大量」「和睦夫婦，教訓子孫，毋慢師長，毋侮聖言」「談道義而化奸頑，講經史而曉愚昧」「舉善薦賢，饒人責己」「造漏澤之仁園，興啟蒙之義塾」「依本分而致謙恭，守規矩而遵法度。諧和宗族，解釋冤怨」「恆記有益之語，罔談非禮之言」；「點夜燈以照人行，造河船以濟人渡」兩句則排在「禁火莫燒山林」的後面。淨空法師專集網流通的本子有六百二十字，只比通行本少「和睦夫婦，教訓子孫，毋慢師長，毋侮聖言」這十六個字。'),
    el('p', null, '用字也略有出入：「捐貲」有的本子作「捐資」，「毋侮聖言」有的作「聖賢」，「名利」有的作「名節」，「網禽鳥」有的作「網禽獸」。本書一律從通行本。'),
    linkList([
      ['維基文庫《文昌帝君陰騭文》', SOURCE.baseUrl],
      ['維基文庫：朱珪《陰隲文註》', SOURCE.zhuguiUrl],
    ]),
  ));

  page.appendChild(section(
    '白話、註解與情境題',
    el('p', null, '白話、難詞註解、導讀、四個典故的故事和生活情境題，由蔬米 OMILKYWAY 編寫（有 AI 協助），不是轉載任何一家的譯本。句子的意思主要依據清代朱珪的《陰隲文註》，並參考周安士的《文昌帝君陰騭文廣義節錄》（收在《安士全書》）。書裡提到「朱珪的註」「清代的註解」，指的就是《陰隲文註》。通行本比這兩家註本多出來的七處沒有古註可依，白話照字面的意思寫。目的是幫初學的人把原文讀懂，難免有不夠精確的地方；義理請以原文和歷代註解為準。'),
    el('p', null, '四個典故的故事，出處各自標在故事後面：于公見《漢書》；竇禹鈞、宋郊、孫叔敖依朱珪的註寫，前兩位並對照了《宋史》，孫叔敖的事另見劉向《新序》《列女傳》和賈誼《新書》。'),
    el('p', null, '這篇文字寫在幾百年前，有些句子帶著當時的社會背景，例如忠於君主、家裡的奴僕、敬惜字紙、不殺耕牛。本書照原文翻譯，並在旁邊註明背景。原文講到神明護佑、善有善報的地方，也是照原文的說法翻譯。'),
    el('p', null, '情境題沒有標準答案，也不計分。'),
  ));

  page.appendChild(section(
    '注音、插圖與朗讀',
    el('p', null, '注音依教育部《國語辭典簡編本》和《重編國語辭典修訂本》，「一」「不」照課本標變調；破音字依文意判斷。'),
    el('p', null, '插圖是 AI 生成的示意圖，畫的是各段的意象，不是歷史考據，也不是神像。'),
    el('p', null, '朗讀使用你的瀏覽器內建的語音，聲音和讀音依裝置而不同；有些字的讀音可能和傳統讀誦不一樣。'),
  ));

  page.appendChild(section(
    '流通',
    el('p', null, '本書免費、非營利，沒有廣告。歡迎分享網址。原文屬於公有領域；白話、註解、插圖與程式由蔬米 OMILKYWAY 製作，歡迎非營利流通，請註明出處。'),
    append(el('p'), el('span', null, '製作：'), link('蔬米 OMILKYWAY', 'https://omilkyway.org/')),
  ));

  const reset = button('清除閱讀進度', 'btn danger', () => {
    if (reset.dataset.armed !== 'yes') {
      reset.dataset.armed = 'yes';
      reset.textContent = '再按一次，確定清除';
      return;
    }
    store.reset();
    reset.dataset.armed = '';
    reset.textContent = '已清除';
    reset.disabled = true;
    ctx.refreshTopbar();
  }, 'reset');
  page.appendChild(section(
    '你的紀錄',
    el('p', null, `閱讀進度、種下的種子（全書 ${TOTAL_LAMPS} 顆）和「每日種福」的紀錄，只存在這台裝置的瀏覽器裡，不會上傳到任何地方。換裝置或清除瀏覽資料，紀錄就會不見。`),
    el('p', null, '有些瀏覽器會自己清：例如 iPhone 的 Safari，大約一個星期沒有回來讀，就會把網站存的資料清掉；如果是嵌在別的網頁裡閱讀，關掉 Safari 之後進度就不在了。想保存得久一點，請直接開啟本書的網址來讀。'),
    // 有裝 Google Analytics 才說（config.js 的 GA_MEASUREMENT_ID 留空就是沒裝）
    GA_MEASUREMENT_ID ? el('p', null, '另外，本書使用 Google Analytics 統計有多少人來讀、看了哪些頁面、從哪裡連過來，不包含上面這些閱讀紀錄。') : null,
    el('p', 'hint', '下面的按鈕只清除閱讀進度和種下的種子，「每日種福」的紀錄會留著。'),
    reset,
  ));

  const actions = el('div', 'land-actions');
  append(actions, button('目錄', 'btn', () => go('toc')), button('回封面', 'btn', () => go('')));
  page.appendChild(actions);
  root.appendChild(page);
}
