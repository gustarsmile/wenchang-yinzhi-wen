import { describe, it, expect } from 'vitest';
import { pickVoice, createSpeech } from '../js/speech.js';

// 假的 speechSynthesis：speak 只記錄，不自動播完；用 finish(i)／fail(i) 手動觸發事件
function fakeSynth(voices = [{ lang: 'zh-TW', name: 'Mei-Jia' }]) {
  const spoken = [];
  return {
    spoken,
    cancelled: 0,
    getVoices: () => voices,
    speak(u) { spoken.push(u); },
    cancel() { this.cancelled += 1; },
    finish(i) { spoken[i].onend?.(); },
    fail(i) { spoken[i].onerror?.(); },
  };
}
class FakeUtterance { constructor(text) { this.text = text; } }

describe('pickVoice', () => {
  it('優先台灣中文', () => {
    const v = pickVoice([{ lang: 'en-US' }, { lang: 'zh-CN', name: 'a' }, { lang: 'zh-TW', name: 'b' }]);
    expect(v.name).toBe('b');
  });
  it('lang 寫成 zh_TW、大小寫不同、或 cmn-Hant-TW 也認得', () => {
    expect(pickVoice([{ lang: 'zh_TW', name: 'x' }]).name).toBe('x');
    expect(pickVoice([{ lang: 'ZH-tw', name: 'y' }]).name).toBe('y');
    expect(pickVoice([{ lang: 'zh-CN', name: 'n' }, { lang: 'cmn-Hant-TW', name: 'z' }]).name).toBe('z');
  });
  it('沒有台灣中文就用其他國語語音', () => {
    expect(pickVoice([{ lang: 'en-US' }, { lang: 'zh-CN', name: 'a' }]).name).toBe('a');
  });
  it('粵語不拿來唸（讀音差太多）', () => {
    expect(pickVoice([{ lang: 'zh-HK', name: 'c' }, { lang: 'yue-HK', name: 'd' }])).toBeNull();
  });
  it('沒有中文語音 → null', () => {
    expect(pickVoice([{ lang: 'en-US' }])).toBeNull();
    expect(pickVoice([])).toBeNull();
    expect(pickVoice(undefined)).toBeNull();
  });
});

describe('createSpeech', () => {
  it('瀏覽器不支援 → supported 為 false，speak／stop 不做事也不丟例外', () => {
    const s = createSpeech({ synth: undefined, Utterance: undefined });
    expect(s.supported).toBe(false);
    expect(() => { s.speak(['一句']); s.stop(); }).not.toThrow();
    expect(s.isSpeaking()).toBe(false);
    expect(s.hasVoice()).toBe(false);
    expect(s.voicesLoaded()).toBe(false);
  });
  it('一句一句依序排進佇列，用台灣中文語音、放慢一點', () => {
    const synth = fakeSynth();
    const s = createSpeech({ synth, Utterance: FakeUtterance });
    expect(s.supported).toBe(true);
    s.speak(['第一句。', '第二句。', '第三句。']);
    expect(synth.spoken.map((u) => u.text)).toEqual(['第一句。', '第二句。', '第三句。']);
    for (const u of synth.spoken) {
      expect(u.lang).toBe('zh-TW');
      expect(u.voice.name).toBe('Mei-Jia');
      expect(u.rate).toBeLessThan(1);
    }
    expect(s.isSpeaking()).toBe(true);
  });
  it('中間的句子唸完不算結束；最後一句唸完才呼叫 onEnd', () => {
    const synth = fakeSynth();
    const s = createSpeech({ synth, Utterance: FakeUtterance });
    let ended = 0;
    s.speak(['一。', '二。'], { onEnd: () => { ended += 1; } });
    synth.finish(0);
    expect(ended).toBe(0);
    expect(s.isSpeaking()).toBe(true);
    synth.finish(1);
    expect(ended).toBe(1);
    expect(s.isSpeaking()).toBe(false);
  });
  it('stop 會中斷並通知一次；被取消的句子晚到的事件不會再通知', () => {
    const synth = fakeSynth();
    const s = createSpeech({ synth, Utterance: FakeUtterance });
    let ended = 0;
    s.speak(['一。', '二。', '三。'], { onEnd: () => { ended += 1; } });
    s.stop();
    expect(synth.cancelled).toBeGreaterThan(0);
    expect(s.isSpeaking()).toBe(false);
    expect(ended).toBe(1);
    synth.finish(2); // 晚到的 onend
    synth.fail(0); // 晚到的 onerror（瀏覽器取消時會發 interrupted）
    expect(ended).toBe(1);
  });
  it('唸到一半再按一次 speak：先停掉舊的，從新的開始；舊句子的事件不影響新的', () => {
    const synth = fakeSynth();
    const s = createSpeech({ synth, Utterance: FakeUtterance });
    let oldEnded = 0; let newEnded = 0;
    s.speak(['舊一。', '舊二。'], { onEnd: () => { oldEnded += 1; } });
    s.speak(['新一。'], { onEnd: () => { newEnded += 1; } });
    expect(oldEnded).toBe(1);
    expect(synth.spoken.at(-1).text).toBe('新一。');
    synth.finish(1); // 舊的最後一句晚到的 onend
    expect(newEnded).toBe(0);
    expect(s.isSpeaking()).toBe(true);
    synth.finish(2);
    expect(newEnded).toBe(1);
  });
  it('沒有中文語音時 hasVoice 為 false；語音清單還沒載入時 voicesLoaded 為 false', () => {
    const en = createSpeech({ synth: fakeSynth([{ lang: 'en-US', name: 'Sam' }]), Utterance: FakeUtterance });
    expect(en.voicesLoaded()).toBe(true);
    expect(en.hasVoice()).toBe(false);
    const empty = createSpeech({ synth: fakeSynth([]), Utterance: FakeUtterance });
    expect(empty.voicesLoaded()).toBe(false);
  });
  it('語音清單是空的（Android Chrome 常見）照樣能唸，只是不指定 voice', () => {
    const synth = fakeSynth([]);
    const s = createSpeech({ synth, Utterance: FakeUtterance });
    s.speak(['一。']);
    expect(synth.spoken).toHaveLength(1);
    expect(synth.spoken[0].voice).toBeUndefined();
    expect(synth.spoken[0].lang).toBe('zh-TW');
  });
  it('空的句子清單不做事', () => {
    const synth = fakeSynth();
    const s = createSpeech({ synth, Utterance: FakeUtterance });
    s.speak([]);
    s.speak(['', null]);
    expect(synth.spoken).toHaveLength(0);
    expect(s.isSpeaking()).toBe(false);
  });
  it('出錯（onerror）時收尾並取消剩下的，不會卡在「唸誦中」', () => {
    const synth = fakeSynth();
    const s = createSpeech({ synth, Utterance: FakeUtterance });
    let ended = 0;
    s.speak(['一。', '二。'], { onEnd: () => { ended += 1; } });
    synth.fail(0);
    expect(s.isSpeaking()).toBe(false);
    expect(ended).toBe(1);
    expect(synth.cancelled).toBeGreaterThan(0);
  });
  it('synth.speak 丟例外也不會往外丟', () => {
    const synth = fakeSynth();
    synth.speak = () => { throw new Error('not allowed'); };
    const s = createSpeech({ synth, Utterance: FakeUtterance });
    expect(() => s.speak(['一。'])).not.toThrow();
    expect(s.isSpeaking()).toBe(false);
  });
});

describe('pickVoice：Android 的語言標記', () => {
  it('zh_TW_#Hant 認得出是台灣中文，而且優先於排在前面的 zh_CN_#Hans', () => {
    const v = pickVoice([{ lang: 'zh_CN_#Hans', name: 'cn' }, { lang: 'zh_TW_#Hant', name: 'tw' }]);
    expect(v.name).toBe('tw');
  });
  it('zh-TW-x-variant 這類帶尾巴的寫法也算台灣中文', () => {
    expect(pickVoice([{ lang: 'zh-CN', name: 'cn' }, { lang: 'zh-TW-x-twn', name: 'tw' }]).name).toBe('tw');
  });
  it('不會把別的地區誤認成台灣（zh-TWX 不是 zh-TW）', () => {
    expect(pickVoice([{ lang: 'zh-CN', name: 'cn' }, { lang: 'zh-twx', name: 'odd' }]).name).toBe('cn');
  });
});
