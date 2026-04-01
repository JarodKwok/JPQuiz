#!/usr/bin/env python3
"""
将课文音频迁移至内容命名体系（books/audio/）
新路径：books/audio/lesson_XX/text_{hash8}.mp3
hash8  = sha256(line.japanese)[:8]  与前端 JS 一致

用法：
    source venv313/bin/activate
    python scripts/migrate_text_audio.py                # 全量生成（复用旧文件）
    python scripts/migrate_text_audio.py --overwrite    # 全量强制重生成
    python scripts/migrate_text_audio.py --lesson 3     # 只处理某课
    python scripts/migrate_text_audio.py --dry-run      # 只统计不生成
"""

import asyncio
import hashlib
import json
import os
import re
import shutil
import argparse
from pathlib import Path

import edge_tts

# ── 声音配置 ──────────────────────────────────────────────────────────
VOICE_MALE   = "ja-JP-KeitaNeural"
VOICE_FEMALE = "ja-JP-NanamiNeural"
RATE = "-10%"

# ── 角色性别表 ────────────────────────────────────────────────────────
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
    speaker = speaker.strip()
    if speaker in FEMALE_SPEAKERS:
        return VOICE_FEMALE
    if speaker in MALE_SPEAKERS:
        return VOICE_MALE
    female_suffixes = ["子", "美", "恵", "江", "代", "香", "奈", "理", "花", "葉"]
    if any(speaker.endswith(s) for s in female_suffixes):
        return VOICE_FEMALE
    return VOICE_MALE


def strip_furigana(text: str) -> str:
    """去除汉字后括号内的假名注音，如 初（はじ）→ 初"""
    return re.sub(r'（[^）]*）', '', text)


def detect_speaker(line_text: str):
    """
    提取说话人前缀和正文。
    格式: "ミラー：text..." 或无前缀
    返回: (speaker, spoken_text, voice)
    spoken_text 已去除假名注音
    """
    m = re.match(r'^([^：:]{1,12})[：:]\s*(.+)$', line_text)
    if m:
        speaker = m.group(1).strip()
        text = strip_furigana(m.group(2).strip())
        voice = get_speaker_voice(speaker)
        return speaker, text, voice
    return None, strip_furigana(line_text), VOICE_MALE


def text_hash(text: str) -> str:
    """SHA-256 前 8 位，与前端 src/services/audio.ts 中 sha256Hash() 一致"""
    return hashlib.sha256(text.encode('utf-8')).hexdigest()[:8]


def is_japanese(text: str) -> bool:
    return bool(re.search(r'[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]', text))


def extract_text_lines(ts_content: str) -> dict:
    """从 builtin-content.ts 提取各课 line() 调用的第 1 参数（japanese）"""
    lessons = {}
    header_re = re.compile(r'//\s*第\s*(\d+)\s*课')
    positions = [(int(m.group(1)), m.start()) for m in header_re.finditer(ts_content)]

    for idx, (lesson_num, start) in enumerate(positions):
        end = positions[idx + 1][1] if idx + 1 < len(positions) else len(ts_content)
        chunk = ts_content[start:end]
        lines = [t for t in re.findall(r'\bline\("([^"]+)"', chunk) if is_japanese(t)]
        lessons[lesson_num] = lines

    return lessons


def build_old_text_map(old_index_path: str) -> dict:
    """从 public/audio/lessons/index.json 建立 text -> 旧文件路径 映射"""
    old_map = {}
    if not os.path.exists(old_index_path):
        return old_map
    with open(old_index_path, encoding='utf-8') as f:
        old_index = json.load(f)
    for lesson_data in old_index.get("lessons", {}).values():
        for entry in lesson_data.get("lines", []):
            text = entry.get("text", "")
            file_rel = entry.get("file", "")
            if text and file_rel:
                old_map[text] = f"public/audio/lessons/{file_rel}"
    return old_map


async def gen(text: str, voice: str, path: str, retries: int = 3) -> bool:
    for attempt in range(retries):
        try:
            communicate = edge_tts.Communicate(text, voice=voice, rate=RATE)
            await communicate.save(path)
            return True
        except Exception as e:
            if attempt < retries - 1:
                wait = 2 ** attempt
                print(f"    ⚠️  重试({attempt + 1}) {text[:15]}... 等待{wait}s")
                await asyncio.sleep(wait)
            else:
                print(f"    ❌ 失败: {text[:20]} ({e})")
                return False
    return False


async def process_lesson(
    lesson_num: int,
    lines: list,
    output_base: str,
    old_text_map: dict,
    dry_run: bool,
    overwrite: bool,
) -> list:
    lesson_dir = f"{output_base}/lesson_{lesson_num:02d}"
    if not dry_run:
        Path(lesson_dir).mkdir(parents=True, exist_ok=True)

    manifest_entries = []
    copied = generated = skipped = failed = 0

    for line_text in lines:
        h = text_hash(line_text)
        filename = f"text_{h}.mp3"
        dest = f"{lesson_dir}/{filename}"
        speaker, spoken_text, voice = detect_speaker(line_text)

        manifest_entries.append({
            "text": line_text,
            "spoken": spoken_text,
            "speaker": speaker,
            "hash": h,
            "voice": voice,
            "file": f"lesson_{lesson_num:02d}/{filename}",
        })

        if dry_run:
            continue

        if os.path.exists(dest) and os.path.getsize(dest) > 1024 and not overwrite:
            skipped += 1
            continue

        # 尝试从旧索引复用
        old_path = old_text_map.get(line_text)
        if old_path and os.path.exists(old_path) and os.path.getsize(old_path) > 1024:
            shutil.copy2(old_path, dest)
            copied += 1
        else:
            ok = await gen(spoken_text, voice, dest)
            if ok:
                generated += 1
            else:
                failed += 1

    print(
        f"  第{lesson_num:02d}课  行数:{len(lines)}"
        f"  复用:{copied}  新生成:{generated}  跳过:{skipped}  失败:{failed}"
    )
    return manifest_entries


async def main_async(args):
    ts_path = "src/data/builtin-content.ts"
    if not os.path.exists(ts_path):
        print("❌ 找不到 src/data/builtin-content.ts，请在项目根目录运行")
        return

    with open(ts_path, encoding='utf-8') as f:
        ts_content = f.read()

    all_lessons = extract_text_lines(ts_content)

    if args.lesson:
        if args.lesson not in all_lessons:
            print(f"❌ 第 {args.lesson} 课不存在")
            return
        lessons = {args.lesson: all_lessons[args.lesson]}
    else:
        lessons = all_lessons

    old_text_map = build_old_text_map("public/audio/lessons/index.json")
    print(f"旧索引映射: {len(old_text_map)} 条课文行")

    output_base = "books/audio"
    manifest_path = f"{output_base}/text_manifest.json"

    # 单课模式：读取现有 manifest 合并，避免覆盖其他课
    master_manifest: dict = {}
    if args.lesson and os.path.exists(manifest_path):
        with open(manifest_path, encoding='utf-8') as f:
            master_manifest = json.load(f)

    total_lines = sum(len(v) for v in lessons.values())
    print(f"\n{'[dry-run] ' if args.dry_run else ''}处理 {len(lessons)} 课，共 {total_lines} 行课文\n")

    for lesson_num in sorted(lessons.keys()):
        entries = await process_lesson(
            lesson_num,
            lessons[lesson_num],
            output_base,
            old_text_map,
            args.dry_run,
            args.overwrite,
        )
        master_manifest[str(lesson_num)] = entries

    if not args.dry_run:
        if not os.path.exists(output_base):
            Path(output_base).mkdir(parents=True, exist_ok=True)
        with open(manifest_path, 'w', encoding='utf-8') as f:
            json.dump(master_manifest, f, ensure_ascii=False, indent=2)
        print(f"\n✅ 索引已保存: {manifest_path}")


def main():
    parser = argparse.ArgumentParser(description="课文音频内容命名迁移工具")
    parser.add_argument("--lesson",    type=int,        help="只处理指定课（默认全部）")
    parser.add_argument("--dry-run",   action="store_true", help="只统计不生成")
    parser.add_argument("--overwrite", action="store_true", help="强制重生成已存在文件")
    args = parser.parse_args()
    asyncio.run(main_async(args))


if __name__ == "__main__":
    main()
