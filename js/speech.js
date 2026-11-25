// 朗讀：包一層瀏覽器內建的 speechSynthesis。不支援的環境全部靜默。

const norm = (v) => String(v?.lang || '').toLowerCase().replace(/_/g, '-');
// Android Chrome 回報的是 zh_TW_#Hant 這種帶尾巴的寫法，所以 -tw 後面允許再接東西
const isTaiwan = (l) => /^(zh|cmn)(-hant)?-tw(-|$)/.test(l);
// 國語才拿來唸；粵語（zh-HK、yue）讀音差太多，寧可不唸
const isMandarin = (l) => (l.startsWith('zh') && !l.startsWith('zh-hk') && !l.startsWith('zh-mo')) || l.startsWith('cmn');

export function pickVoice(voices) {
  const list = Array.from(voices || []);
  return list.find((v) => isTaiwan(norm(v))) || list.find((v) => isMandarin(norm(v))) || null;
}

export function createSpeech({ synth = globalThis.speechSynthesis, Utterance = globalThis.SpeechSynthesisUtterance } = {}) {
  const supported = Boolean(synth && Utterance);
  // session：每次 speak／stop 就換一個號碼。被取消的句子晚到的事件拿著舊號碼，會被忽略
  let session = 0;
  let speaking = false;
  let done = null;
  // 留著這一輪的句子物件：Chrome 會把沒人參考的 utterance 回收掉，結果 onend 永遠不來
  let queue = [];

  const voices = () => { try { return synth.getVoices(); } catch { return []; } };

  function finish() {
    session += 1;
    speaking = false;
    queue = [];
    const cb = done;
    done = null;
    cb?.();
  }

  function stop() {
    if (!supported) return;
    const was = speaking;
    try { synth.cancel(); } catch { /* 忽略 */ }
    if (was) finish();
  }

  // 斷成一句一句再全部交給瀏覽器排隊：
  // 整段當一句送，Chrome 唸十幾秒會自己斷掉；
  // 等上一句的 onend 才送下一句，有些手機的 onend 不可靠，會唸一句就停。
  function speak(sentences, { onEnd } = {}) {
    if (!supported) return;
    stop();
    const list = (sentences || []).filter(Boolean);
    if (!list.length) return;
    session += 1;
    const id = session;
    speaking = true;
    done = onEnd || null;
    const voice = pickVoice(voices());
    queue = list.map((text, i) => {
      const u = new Utterance(text);
      u.lang = 'zh-TW';
      if (voice) u.voice = voice;
      u.rate = 0.9;
      if (i === list.length - 1) u.onend = () => { if (id === session) finish(); };
      u.onerror = () => { if (id === session) stop(); };
      return u;
    });
    try {
      for (const u of queue) synth.speak(u);
    } catch {
      stop();
    }
  }

  return {
    supported,
    speak,
    stop,
    isSpeaking: () => speaking,
    // Chrome 的語音清單是非同步載入的，一開始可能是空的：
    // voicesLoaded 為 false 時還不能斷定「沒有中文語音」
    voicesLoaded: () => supported && voices().length > 0,
    hasVoice: () => supported && pickVoice(voices()) !== null,
  };
}
