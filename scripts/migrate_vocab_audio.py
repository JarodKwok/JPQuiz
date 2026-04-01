#!/usr/bin/env python3
"""
将旧 public/audio/lessons/ 中的词汇音频迁移到 books/audio/ 内容命名体系。

迁移策略：
  旧命名：public/audio/lessons/lesson_01/vocab_000.mp3  (按索引)
  新命名：books/audio/lesson_01/vocab_わたし.mp3         (按读音内容)

算法：
  1. 读取 public/audio/lessons/index.json，建立 text -> 旧文件路径 的全局映射
  2. 解析 books/book1.md，获取当前各课词汇（读音列表）
  3. 对每个词汇：
       - 若读音在旧索引中找到 → 直接复制 MP3（零成本，高质量复用）
       - 未找到 → 调用 Edge TTS 生成新音频（拟人化男声 KeitaNeural）
  4. 生成 books/audio/manifest.json

用法:
  source venv313/bin/activate
  python scripts/migrate_vocab_audio.py          # 全部25课
  python scripts/migrate_vocab_audio.py --lesson 1  # 仅第1课
  python scripts/migrate_vocab_audio.py --dry-run   # 仅统计，不操作文件
  python scripts/migrate_vocab_audio.py --overwrite # 覆盖已存在的目标文件
"""

import asyncio
import json
import os
import re
import shutil
import argparse
from pathlib import Path

try:
    import edge_tts
except ImportError:
    print("❌ 请先安装 edge-tts：pip install edge-tts")
    raise

# ── 配置 ─────────────────────────────────────────────────────────────────────
SRC_BASE   = Path("public/audio/lessons")
DST_BASE   = Path("books/audio")
INDEX_PATH = SRC_BASE / "index.json"
BOOK_PATH  = "books/book1.md"

VOICE_MALE = "ja-JP-KeitaNeural"
RATE       = "-10%"


# ── 文本清理（与 generate_books_audio.py 保持一致）──────────────────────────

def clean_reading(raw: str) -> str:
    text = re.sub(r'（[^）]*）', '', raw)
    text = re.sub(r'<small>[^<]*</small>', '', text)
    text = re.sub(r'\[([^\]]+)\]', r'\1', text)
    return text.strip()


def sanitize_for_filename(reading: str) -> str:
    name = reading
    name = name.replace('〜', '').replace('～', '')
    name = re.sub(r'\[[^\]]*\]', '', name)
    name = re.sub(r'（[^）]*）', '', name)
    name = re.sub(r'\([^)]*\)', '', name)
    name = name.replace(' ', '_').replace('　', '_')
    name = re.sub(r'[/\\:*?"<>|・]', '', name)
    return name.strip('_').strip() or 'unknown'


def speak_text_for(reading: str) -> str:
    text = reading.replace('〜', '').replace('～', '')
    text = re.sub(r'\[[^\]]*\]', '', text)
    text = re.sub(r'（[^）]*）', '', text)
    return text.strip() or reading


# ── 解析 book1.md 词汇（与 generate_books_audio.py 一致）────────────────────

def parse_book1(book_path: str) -> dict:
    with open(book_path, encoding='utf-8') as f:
        content = f.read()

    lessons = {}
    parts = ('\n' + content).split('\n## 第')
    for part in parts[1:]:
        m = re.match(r'(\d+)课\n', part)
        if not m:
            continue
        lesson_num = int(m.group(1))
        vocab_items = []
        in_vocab = False
        in_greet = False

        for line in part.split('\n'):
            if re.match(r'###\s+1\.\s+词汇', line):
                in_vocab = True
                in_greet = False
                continue
            if in_vocab and re.match(r'###\s+\d+', line):
                break
            if not in_vocab:
                continue
            if '| 表达 |' in line or '| 表达|' in line:
                in_greet = True
                continue
            if not line.startswith('|'):
                continue
            if '---' in line:
                continue

            cols = [c.strip() for c in line.split('|') if c.strip()]

            if in_greet:
                if len(cols) >= 2 and cols[0] not in ('表达', ''):
                    raw = cols[0]
                    raw = re.sub(r'<small>[^<]*</small>', '', raw)
                    raw = re.sub(r'\[([^\]]+)\]', r'\1', raw)
                    speak = raw.strip()
                    if speak and re.search(r'[\u3040-\u30ff\u4e00-\u9fff]', speak):
                        filename = sanitize_for_filename(speak)
                        vocab_items.append({
                            'reading': speak,
                            'speak': speak,
                            'filename': filename,
                            'type': 'greeting',
                        })
                continue

            if len(cols) < 4:
                if '读音' in cols:
                    in_greet = False
                continue
            if cols[0] in ('读音', '単語', '単词'):
                in_greet = False
                continue

            raw_reading = cols[0]
            reading = clean_reading(raw_reading)
            if not reading:
                continue
            if re.match(r'^[\d\s]+$', reading):
                continue

            speak = speak_text_for(reading)
            filename = sanitize_for_filename(reading)
            vocab_items.append({
                'reading': reading,
                'speak': speak,
                'filename': filename,
            })

        lessons[lesson_num] = vocab_items

    return lessons


# ── 构建旧索引全局查找表 ─────────────────────────────────────────────────────

def build_old_lookup(index_path: Path) -> dict:
    """从旧 index.json 建立 text -> 绝对文件路径 的查找表"""
    if not index_path.exists():
        return {}
    with open(index_path, encoding='utf-8') as f:
        data = json.load(f)
    lookup = {}
    for lesson_data in data.get('lessons', {}).values():
        for entry in lesson_data.get('vocab', []):
            text = entry.get('text', '').strip()
            rel  = entry.get('file', '')
            if text and rel:
                full = SRC_BASE / rel.split('/')[-2] / rel.split('/')[-1]  # lesson_XX/vocab_NNN.mp3
                # 更健壮的路径构建
                full = SRC_BASE / Path(rel)
                if text not in lookup:  # 保留第一次出现的（通常课次最小）
                    lookup[text] = full
    return lookup


# ── TTS 生成（回退用）────────────────────────────────────────────────────────

async def gen_tts(text: str, path: Path, retries: int = 3) -> bool:
    for attempt in range(retries):
        try:
            communicate = edge_tts.Communicate(text, voice=VOICE_MALE, rate=RATE)
            await communicate.save(str(path))
            return True
        except Exception as e:
            if attempt < retries - 1:
                wait = 2 ** attempt
                print(f"    ⚠ 重试({attempt+1}) {text[:15]!r} 等待{wait}s: {e}")
                await asyncio.sleep(wait)
            else:
                print(f"    ❌ TTS失败: {text[:20]!r}  {e}")
    return False


# ── 处理单课 ──────────────────────────────────────────────────────────────────

async def migrate_lesson(
    lesson_num: int,
    vocab_items: list,
    old_lookup: dict,
    overwrite: bool,
    dry_run: bool,
) -> dict:
    lesson_dir = DST_BASE / f"lesson_{lesson_num:02d}"
    if not dry_run:
        lesson_dir.mkdir(parents=True, exist_ok=True)

    manifest = []
    copied = skipped = generated = failed = 0

    for item in vocab_items:
        dst_name = f"vocab_{item['filename']}.mp3"
        dst_path = lesson_dir / dst_name
        rel_path = f"lesson_{lesson_num:02d}/{dst_name}"

        manifest.append({
            'reading': item['reading'],
            'speak':   item['speak'],
            'file':    rel_path,
        })

        if dry_run:
            src = old_lookup.get(item['reading'])
            tag = "→复用" if (src and src.exists()) else "→新TTS"
            print(f"    {tag}  {item['reading']}")
            continue

        if dst_path.exists() and not overwrite:
            skipped += 1
            continue

        # 尝试从旧文件复用
        src = old_lookup.get(item['reading'])
        if src and src.exists():
            shutil.copy2(src, dst_path)
            copied += 1
        else:
            # 生成新 TTS
            ok = await gen_tts(item['speak'], dst_path)
            if ok:
                generated += 1
                await asyncio.sleep(0.15)
            else:
                failed += 1

    if not dry_run:
        parts = [f"复用:{copied}", f"新TTS:{generated}", f"跳过:{skipped}"]
        if failed:
            parts.append(f"失败:{failed}")
        print(f"  ✅ 第{lesson_num:02d}课  词汇:{len(manifest)}  {' '.join(parts)}")

    return {'items': manifest, 'copied': copied, 'generated': generated,
            'skipped': skipped, 'failed': failed}


# ── 主程序 ────────────────────────────────────────────────────────────────────

async def main_async(args):
    if not os.path.exists(BOOK_PATH):
        print(f"❌ 找不到 {BOOK_PATH}，请在项目根目录运行")
        return

    print(f"解析 {BOOK_PATH} ...")
    lessons = parse_book1(BOOK_PATH)
    print(f"共解析 {len(lessons)} 课")

    print(f"读取旧音频索引 {INDEX_PATH} ...")
    old_lookup = build_old_lookup(INDEX_PATH)
    print(f"旧索引词汇条目: {len(old_lookup)} 条\n")

    if args.lesson:
        if args.lesson not in lessons:
            print(f"❌ 第 {args.lesson} 课不存在（可用: {sorted(lessons)[:5]}...）")
            return
        lessons = {args.lesson: lessons[args.lesson]}

    mode = '[dry-run] ' if args.dry_run else ''
    print(f"{mode}迁移 {len(lessons)} 课词汇音频")
    print(f"来源: {SRC_BASE}/  →  目标: {DST_BASE}/")
    print(f"声音(新生成): {VOICE_MALE}  语速: {RATE}")
    print(f"覆盖已存在: {'是' if args.overwrite else '否'}\n")

    master_manifest = {}
    totals = {'words': 0, 'copied': 0, 'generated': 0, 'skipped': 0, 'failed': 0}

    for lesson_num in sorted(lessons.keys()):
        result = await migrate_lesson(
            lesson_num,
            lessons[lesson_num],
            old_lookup,
            overwrite=args.overwrite,
            dry_run=args.dry_run,
        )
        master_manifest[str(lesson_num)] = result['items']
        totals['words']     += len(result['items'])
        totals['copied']    += result['copied']
        totals['generated'] += result['generated']
        totals['skipped']   += result['skipped']
        totals['failed']    += result['failed']

    print(f"\n总计: {totals['words']} 词汇")
    if not args.dry_run:
        print(f"  复用旧文件: {totals['copied']}")
        print(f"  新生成TTS:  {totals['generated']}")
        print(f"  跳过(已存在): {totals['skipped']}")
        if totals['failed']:
            print(f"  ❌ 失败:   {totals['failed']}")

        # 写 manifest（单课模式时合并已有 manifest，保留其他课数据）
        DST_BASE.mkdir(parents=True, exist_ok=True)
        manifest_path = DST_BASE / "manifest.json"
        if args.lesson and manifest_path.exists():
            with open(manifest_path, encoding='utf-8') as f:
                existing = json.load(f)
            existing_lessons = existing.get('lessons', {})
            existing_lessons.update(master_manifest)
            master_manifest = existing_lessons

        manifest_data = {
            "version": "2.0",
            "description": "大家的日语 AI陪练版 - 词汇音频索引（内容命名体系）",
            "source": "books/book1.md",
            "voice": VOICE_MALE,
            "rate": RATE,
            "format": "mp3",
            "naming": "vocab_{reading}.mp3  基于读音，与顺序无关",
            "total_words": totals['words'],
            "reused_from_legacy": totals['copied'],
            "new_generated": totals['generated'],
            "lessons": master_manifest,
        }
        with open(manifest_path, 'w', encoding='utf-8') as f:
            json.dump(manifest_data, f, ensure_ascii=False, indent=2)
        print(f"\n✅ manifest 已保存: {manifest_path}")
        print("前端访问路径: /api/audio/books/lesson_01/vocab_わたし.mp3")


def main():
    parser = argparse.ArgumentParser(
        description="将旧 public/audio 词汇音频迁移到 books/audio 内容命名体系"
    )
    parser.add_argument('--lesson',    type=int,  help='只处理指定课（默认全部）')
    parser.add_argument('--dry-run',   action='store_true', help='只统计，不操作文件')
    parser.add_argument('--overwrite', action='store_true', help='覆盖已存在的目标文件')
    args = parser.parse_args()
    asyncio.run(main_async(args))


if __name__ == '__main__':
    main()
