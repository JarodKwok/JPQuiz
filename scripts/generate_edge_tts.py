#!/usr/bin/env python3
"""
使用 Edge TTS 批量生成《大家的日语》1-25课音频

规则:
- 词汇 / 例句 / 听力 → 男声 ja-JP-KeitaNeural
- 课文对话 → 按说话人性别选声音
  - 已知女性角色 → ja-JP-NanamiNeural
  - 其他/未知     → ja-JP-KeitaNeural

使用方法:
    source venv313/bin/activate
    python scripts/generate_edge_tts.py          # 生成全部25课
    python scripts/generate_edge_tts.py --lesson 1   # 只生成第1课
    python scripts/generate_edge_tts.py --dry-run    # 只统计不生成
"""

import asyncio
import os
import re
import json
import argparse
from pathlib import Path

import edge_tts

# ── 声音配置 ─────────────────────────────────────────────────────────
VOICE_MALE   = "ja-JP-KeitaNeural"   # 男声
VOICE_FEMALE = "ja-JP-NanamiNeural"  # 女声
RATE = "-10%"   # 略慢，便于学习

# ── 角色性别表（みんなの日本語 全册角色）────────────────────────────
FEMALE_SPEAKERS = {
    "カリナ", "ワン", "佐藤", "てんいん", "店員", "みせいん",
    "マリア", "テレーザ", "アンナ", "ゆきこ", "さとうけいこ",
}
MALE_SPEAKERS = {
    "ミラー", "グプタ", "山田", "山田一郎", "やまだ", "サントス",
    "木村", "ワット", "カルロス", "ホセ", "タクシーのうんてんしゅ",
    "タクシーの うんてんしゅ", "せんせい", "がくせい", "ゆうびんきょくのいん",
    "ゆうびんきょくの いん",
}

def get_speaker_voice(speaker: str) -> str:
    """根据说话人名字判断声音"""
    speaker = speaker.strip()
    if speaker in FEMALE_SPEAKERS:
        return VOICE_FEMALE
    if speaker in MALE_SPEAKERS:
        return VOICE_MALE
    # 名字末尾含女性汉字则用女声
    female_suffixes = ["子", "美", "恵", "江", "代", "香", "奈", "理", "花", "葉"]
    if any(speaker.endswith(s) for s in female_suffixes):
        return VOICE_FEMALE
    return VOICE_MALE  # 默认男声

def detect_speaker(line_text: str):
    """
    从课文行提取说话人和正文。
    格式: "ミラー：text..." 或 "山田一郎：text..."
    返回: (speaker, text, voice)
    """
    # 匹配 "说话人：" 前缀（支持全角和半角冒号）
    m = re.match(r'^([^：:]{1,12})[：:]\s*(.+)$', line_text)
    if m:
        speaker = m.group(1).strip()
        text = m.group(2).strip()
        voice = get_speaker_voice(speaker)
        return speaker, text, voice
    return None, line_text, VOICE_MALE

def is_japanese(text: str) -> bool:
    return bool(re.search(r'[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]', text))

def extract_lessons(ts_content: str) -> dict:
    """从 TypeScript 源码提取各课内容"""
    lessons = {}

    # 按课号分段
    header_re = re.compile(r'//\s*第\s*(\d+)\s*课')
    positions = [(int(m.group(1)), m.start()) for m in header_re.finditer(ts_content)]

    for idx, (lesson_num, start) in enumerate(positions):
        end = positions[idx + 1][1] if idx + 1 < len(positions) else len(ts_content)
        chunk = ts_content[start:end]

        # 词汇：v("word", ...) 第1参数
        vocab    = [t for t in re.findall(r'\bv\("([^"]+)"', chunk)    if is_japanese(t)]
        # 句型示例：p("id","pattern","meaning","structure","sampleJapanese",...) 第5参数
        patterns = [t for t in re.findall(r'\bp\("[^"]*",\s*"[^"]*",\s*"[^"]*",\s*"[^"]*",\s*"([^"]+)"', chunk) if is_japanese(t)]
        # 例句：e("japanese", ...) 第1参数
        examples = [t for t in re.findall(r'\be\("([^"]+)"', chunk)    if is_japanese(t)]
        # 课文行：line("japanese", ...) 第1参数，保留原始文本（含说话人前缀）
        lines    = [t for t in re.findall(r'\bline\("([^"]+)"', chunk)  if is_japanese(t)]
        # 听力：q("text", ...) 第1参数
        listening= [t for t in re.findall(r'\bq\("([^"]+)"', chunk)    if is_japanese(t)]

        lessons[lesson_num] = {
            "vocab": vocab,
            "patterns": patterns,
            "examples": examples,
            "lines": lines,
            "listening": listening,
        }

    return lessons

async def gen(text: str, voice: str, path: str, retries: int = 3):
    """异步生成单个音频文件，失败自动重试"""
    for attempt in range(retries):
        try:
            communicate = edge_tts.Communicate(text, voice=voice, rate=RATE)
            await communicate.save(path)
            return
        except Exception as e:
            if attempt < retries - 1:
                wait = 2 ** attempt
                print(f"    ⚠️  重试({attempt+1}/{retries-1}) {text[:15]}... 等待{wait}s")
                await asyncio.sleep(wait)
            else:
                print(f"    ❌ 失败: {text[:20]} ({e})")
                raise

async def generate_lesson(lesson_num: int, content: dict, output_base: str, dry_run: bool, overwrite: bool = False) -> dict:
    """生成单课全部音频，返回课索引"""
    lesson_dir = f"{output_base}/lesson_{lesson_num:02d}"
    if not dry_run:
        Path(lesson_dir).mkdir(parents=True, exist_ok=True)

    index = {"vocab": [], "patterns": [], "examples": [], "lines": [], "listening": []}
    tasks = []

    # 词汇 → 男声
    for i, word in enumerate(content["vocab"]):
        rel = f"lesson_{lesson_num:02d}/vocab_{i:03d}.mp3"
        full = f"{output_base}/{rel}"
        index["vocab"].append({"text": word, "file": rel})
        if not dry_run and (not os.path.exists(full) or overwrite):
            tasks.append(gen(word, VOICE_MALE, full))

    # 句型示例 → 男声
    for i, sent in enumerate(content["patterns"]):
        rel = f"lesson_{lesson_num:02d}/pattern_{i:03d}.mp3"
        full = f"{output_base}/{rel}"
        index["patterns"].append({"text": sent, "file": rel})
        if not dry_run and (not os.path.exists(full) or overwrite):
            tasks.append(gen(sent, VOICE_MALE, full))

    # 例句 → 男声
    for i, sent in enumerate(content["examples"]):
        rel = f"lesson_{lesson_num:02d}/example_{i:03d}.mp3"
        full = f"{output_base}/{rel}"
        index["examples"].append({"text": sent, "file": rel})
        if not dry_run and (not os.path.exists(full) or overwrite):
            tasks.append(gen(sent, VOICE_MALE, full))

    # 课文行 → 按说话人性别
    for i, line_text in enumerate(content["lines"]):
        speaker, spoken_text, voice = detect_speaker(line_text)
        rel = f"lesson_{lesson_num:02d}/text_{i:03d}.mp3"
        full = f"{output_base}/{rel}"
        index["lines"].append({
            "text": line_text,
            "spoken": spoken_text,
            "speaker": speaker,
            "voice": voice,
            "file": rel,
        })
        if not dry_run and (not os.path.exists(full) or overwrite):
            tasks.append(gen(spoken_text, voice, full))

    # 听力 → 男声
    for i, li_text in enumerate(content["listening"]):
        rel = f"lesson_{lesson_num:02d}/listening_{i:03d}.mp3"
        full = f"{output_base}/{rel}"
        index["listening"].append({"text": li_text, "file": rel})
        if not dry_run and (not os.path.exists(full) or overwrite):
            tasks.append(gen(li_text, VOICE_MALE, full))

    if tasks:
        # 顺序生成，避免微软服务限流/超时
        for coro in tasks:
            try:
                await coro
            except Exception:
                pass  # 错误已在 gen() 内打印，继续生成其余文件

    total = len(index["vocab"]) + len(index["patterns"]) + len(index["examples"]) + len(index["lines"]) + len(index["listening"])
    print(f"  ✅ 第{lesson_num:02d}课  词汇:{len(index['vocab'])}  句型:{len(index['patterns'])}  "
          f"例句:{len(index['examples'])}  课文:{len(index['lines'])}  听力:{len(index['listening'])}  合计:{total}")
    return index

async def main_async(args):
    # 读取 TypeScript 数据
    ts_path = "src/data/builtin-content.ts"
    if not os.path.exists(ts_path):
        print("❌ 找不到 src/data/builtin-content.ts，请在项目根目录运行")
        return

    with open(ts_path, encoding="utf-8") as f:
        ts_content = f.read()

    lessons = extract_lessons(ts_content)

    if args.lesson:
        if args.lesson not in lessons:
            print(f"❌ 第 {args.lesson} 课不存在")
            return
        lessons = {args.lesson: lessons[args.lesson]}

    output_base = "public/audio/lessons"
    if not args.dry_run:
        Path(output_base).mkdir(parents=True, exist_ok=True)

    print(f"{'[dry-run] ' if args.dry_run else ''}生成 {len(lessons)} 课音频")
    print(f"男声: {VOICE_MALE}  女声: {VOICE_FEMALE}  语速: {RATE}\n")

    master_index = {}
    total_files = 0

    for lesson_num in sorted(lessons.keys()):
        idx = await generate_lesson(lesson_num, lessons[lesson_num], output_base, args.dry_run, getattr(args, 'overwrite', False))
        master_index[str(lesson_num)] = idx
        total_files += (len(idx["vocab"]) + len(idx["examples"]) +
                        len(idx["lines"]) + len(idx["listening"]))

    print(f"\n总计: {total_files} 个音频文件")

    if not args.dry_run:
        index_data = {
            "version": "1.0",
            "voice_male": VOICE_MALE,
            "voice_female": VOICE_FEMALE,
            "rate": RATE,
            "format": "mp3",
            "total_files": total_files,
            "lessons": master_index,
        }
        index_path = f"{output_base}/index.json"
        with open(index_path, "w", encoding="utf-8") as f:
            json.dump(index_data, f, ensure_ascii=False, indent=2)
        print(f"✅ 索引已保存: {index_path}")
        print("\n下一步：前端已自动集成，刷新页面即可使用")

def main():
    parser = argparse.ArgumentParser(description="Edge TTS 日语音频批量生成")
    parser.add_argument("--lesson",    type=int, help="只生成指定课（默认全部）")
    parser.add_argument("--dry-run",   action="store_true", help="只统计不生成")
    parser.add_argument("--overwrite", action="store_true", help="覆盖已存在的音频文件")
    args = parser.parse_args()
    asyncio.run(main_async(args))

if __name__ == "__main__":
    main()
