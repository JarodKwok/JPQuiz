/**
 * 音频播放服务
 * 优先播放预生成的 MP3（Edge TTS），无文件时回退到浏览器 Web Speech API
 *
 * 文件命名规则：
 *   词汇  → /api/audio/books/lesson_01/vocab_{reading}.mp3      （内容命名）
 *   例句  → /api/audio/books/lesson_01/example_{hash8}.mp3      （内容命名）
 *   句型  → /api/audio/books/lesson_01/pattern_{hash8}.mp3      （内容命名）
 *   课文  → /api/audio/books/lesson_01/text_{hash8}.mp3         （内容命名）
 *   听力  → /audio/lessons/lesson_01/listening_000.mp3          （索引命名）
 */

const AUDIO_BASE = "/audio/lessons";
const BOOKS_AUDIO_BASE = "/api/audio/books";

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

/** SHA-256 前 8 位，与 Python scripts/migrate_examples_audio.py text_hash() 一致 */
async function sha256Hash(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 8);
}

function sanitizeReading(reading: string): string {
  let name = reading;
  name = name.replace(/〜/g, "").replace(/～/g, "");
  name = name.replace(/\[[^\]]*\]/g, "");
  name = name.replace(/（[^）]*）/g, "");
  name = name.replace(/\([^)]*\)/g, "");
  name = name.replace(/[ \u3000]/g, "_");
  name = name.replace(/[/\\:*?"<>|・]/g, "");
  return name.replace(/^_+|_+$/g, "").trim() || "unknown";
}

/**
 * 播放词汇音频（content-based 命名，来自 books/audio/）
 * @param text     朗读文本（回退用）
 * @param lessonId 课号（1-25）
 * @param reading  词汇读音（用于构造文件名）
 */
export async function speakVocab(
  text: string,
  lessonId: number,
  reading: string
): Promise<void> {
  stopCurrentAudio();

  const lesson = `lesson_${String(lessonId).padStart(2, "0")}`;
  const filename = `vocab_${sanitizeReading(reading)}.mp3`;
  const url = `${BOOKS_AUDIO_BASE}/${lesson}/${filename}`;

  const audio = new Audio(url);
  currentAudio = audio;

  await audio.play().catch(() => {
    currentAudio = null;
    fallback(text);
  });
}

/**
 * 播放例句/句型音频（content hash 命名，来自 books/audio/）
 * @param text     日语文本（用于计算 hash 和回退 TTS）
 * @param lessonId 课号（1-25）
 * @param type     "example" | "pattern"
 */
export async function speakExample(
  text: string,
  lessonId: number,
  type: "example" | "pattern" = "example"
): Promise<void> {
  stopCurrentAudio();

  const hash = await sha256Hash(text);
  const lesson = `lesson_${String(lessonId).padStart(2, "0")}`;
  const filename = `${type}_${hash}.mp3`;
  const url = `${BOOKS_AUDIO_BASE}/${lesson}/${filename}`;

  const audio = new Audio(url);
  currentAudio = audio;

  await audio.play().catch(() => {
    currentAudio = null;
    fallback(text);
  });
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
 * 播放课文行音频（content hash 命名，来自 books/audio/）
 * hash 基于完整的 line.japanese（含说话人前缀），与 migrate_text_audio.py 一致
 * @param japanese  line.japanese 原文（含说话人前缀）
 * @param lessonId  课号（1-25）
 */
export async function speakText(
  japanese: string,
  lessonId: number
): Promise<void> {
  stopCurrentAudio();

  const hash = await sha256Hash(japanese);
  const lesson = `lesson_${String(lessonId).padStart(2, "0")}`;
  const url = `${BOOKS_AUDIO_BASE}/${lesson}/text_${hash}.mp3`;

  const audio = new Audio(url);
  currentAudio = audio;

  await audio.play().catch(() => {
    currentAudio = null;
    // 回退：去掉说话人前缀后用 Web Speech API 朗读
    const spoken = japanese.replace(/^[^：:]{1,12}[：:]\s*/, "").replace(/（[^）]*）/g, "");
    fallback(spoken);
  });
}

/**
 * 顺序朗读整篇课文
 * @param lines      课文行数组（line.japanese）
 * @param lessonId   课号
 * @param onProgress 每播一行后回调，传入当前行索引（-1 表示结束）
 */
export async function speakTextAll(
  lines: string[],
  lessonId: number,
  onProgress?: (index: number) => void
): Promise<void> {
  stopCurrentAudio();

  for (let i = 0; i < lines.length; i++) {
    // 如果外部调用了 stop()，currentAudio 会被清空 → 中断循环
    const japanese = lines[i];
    const hash = await sha256Hash(japanese);
    const lesson = `lesson_${String(lessonId).padStart(2, "0")}`;
    const url = `${BOOKS_AUDIO_BASE}/${lesson}/text_${hash}.mp3`;

    onProgress?.(i);

    const played = await new Promise<boolean>((resolve) => {
      const audio = new Audio(url);
      currentAudio = audio;
      audio.onended = () => resolve(true);
      audio.onerror = () => resolve(false);
      audio.play().catch(() => resolve(false));
    });

    // stop() 被调用时 currentAudio 已置 null，退出循环
    if (currentAudio === null && i < lines.length - 1) break;

    if (!played) {
      const spoken = japanese.replace(/^[^：:]{1,12}[：:]\s*/, "").replace(/（[^）]*）/g, "");
      await new Promise<void>((resolve) => {
        if (typeof window === "undefined" || !("speechSynthesis" in window)) {
          resolve();
          return;
        }
        const utterance = new SpeechSynthesisUtterance(spoken);
        utterance.lang = "ja-JP";
        utterance.rate = 0.8;
        utterance.onend = () => resolve();
        speechSynthesis.speak(utterance);
      });
    }
  }

  currentAudio = null;
  onProgress?.(-1);
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
