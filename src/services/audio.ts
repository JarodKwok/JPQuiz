/**
 * 音频播放服务
 * 优先播放预生成的 MP3（Edge TTS），无文件时回退到浏览器 Web Speech API
 *
 * 文件命名规则（无需 index.json）：
 *   /audio/lessons/lesson_01/vocab_000.mp3
 *   /audio/lessons/lesson_01/example_000.mp3
 *   /audio/lessons/lesson_01/text_000.mp3
 *   /audio/lessons/lesson_01/listening_000.mp3
 */

const AUDIO_BASE = "/audio/lessons";

type AudioType = "vocab" | "pattern" | "example" | "text" | "listening";

// 当前播放的 Audio 实例
let currentAudio: HTMLAudioElement | null = null;

function buildUrl(lessonId: number, type: AudioType, itemIndex: number): string {
  const lesson = `lesson_${String(lessonId).padStart(2, "0")}`;
  const file = `${type}_${String(itemIndex).padStart(3, "0")}.mp3`;
  return `${AUDIO_BASE}/${lesson}/${file}`;
}

function stopCurrentAudio() {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio = null;
  }
}

function fallback(text: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "ja-JP";
  utterance.rate = 0.8;
  speechSynthesis.speak(utterance);
}

/**
 * 播放日语音频
 * @param text       显示的文本（用于回退 TTS）
 * @param lessonId   课号（1-25）
 * @param type       类型：vocab / example / text / listening
 * @param itemIndex  在该课该类型中的序号（0-based），-1 表示强制回退
 */
export async function speak(
  text: string,
  lessonId: number,
  type: AudioType,
  itemIndex: number
): Promise<void> {
  stopCurrentAudio();

  if (itemIndex < 0) {
    fallback(text);
    return;
  }

  const url = buildUrl(lessonId, type, itemIndex);
  const audio = new Audio(url);
  currentAudio = audio;

  await audio.play().catch(() => {
    currentAudio = null;
    fallback(text);
  });
}

/**
 * 顺序播放一组音频（例：整篇课文）
 */
export async function speakAll(
  items: { text: string; lessonId: number; type: AudioType; index: number }[]
): Promise<void> {
  stopCurrentAudio();

  for (const item of items) {
    if (item.index < 0) continue;
    const url = buildUrl(item.lessonId, item.type, item.index);

    const played = await new Promise<boolean>((resolve) => {
      const audio = new Audio(url);
      currentAudio = audio;
      audio.onended = () => resolve(true);
      audio.onerror = () => resolve(false);
      audio.play().catch(() => resolve(false));
    });

    if (!played) {
      // 该条回退到 Web Speech API
      await new Promise<void>((resolve) => {
        if (typeof window === "undefined" || !("speechSynthesis" in window)) {
          resolve();
          return;
        }
        const utterance = new SpeechSynthesisUtterance(item.text);
        utterance.lang = "ja-JP";
        utterance.rate = 0.8;
        utterance.onend = () => resolve();
        speechSynthesis.speak(utterance);
      });
    }
  }

  currentAudio = null;
}

export function stop() {
  stopCurrentAudio();
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    speechSynthesis.cancel();
  }
}

/**
 * 播放胜利音效（Web Audio API 合成，无需音频文件）
 * 当模块掌握度达到 100% 时调用
 */
export function playVictory() {
  if (typeof window === "undefined") return;

  const ctx = new AudioContext();

  // 上行琶音 + 终止和弦，约 1.5 秒
  const sequence: { freq: number; start: number; dur: number; vol: number }[] = [
    { freq: 523.25, start: 0.0,  dur: 0.12, vol: 0.25 }, // C5
    { freq: 659.25, start: 0.12, dur: 0.12, vol: 0.25 }, // E5
    { freq: 783.99, start: 0.24, dur: 0.12, vol: 0.25 }, // G5
    { freq: 1046.5, start: 0.36, dur: 0.12, vol: 0.28 }, // C6
    // 终止和弦 (C E G C 同时响)
    { freq: 523.25, start: 0.52, dur: 0.8,  vol: 0.2  },
    { freq: 659.25, start: 0.52, dur: 0.8,  vol: 0.2  },
    { freq: 783.99, start: 0.52, dur: 0.8,  vol: 0.2  },
    { freq: 1046.5, start: 0.52, dur: 0.8,  vol: 0.22 },
  ];

  sequence.forEach(({ freq, start, dur, vol }) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = "triangle"; // 柔和音色
    osc.frequency.value = freq;

    const t = ctx.currentTime + start;
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);

    osc.start(t);
    osc.stop(t + dur + 0.05);
  });

  // 自动关闭 AudioContext 释放资源
  setTimeout(() => void ctx.close(), 2000);
}
