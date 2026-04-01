#!/usr/bin/env python3
"""
从 books/book1.md 生成词汇音频，输出到 books/audio/ 目录。

命名规则（与顺序无关，与内容绑定）：
  books/audio/lesson_01/vocab_わたし.mp3
  books/audio/lesson_01/vocab_がくせい.mp3
  ...

这样无论词汇顺序如何调整，音频文件始终正确匹配。

用法:
  source venv313/bin/activate  (若使用虚拟环境)
  python scripts/generate_books_audio.py             # 全部 25 课
  python scripts/generate_books_audio.py --lesson 1  # 仅第 1 课
  python scripts/generate_books_audio.py --dry-run   # 仅统计，不生成
  python scripts/generate_books_audio.py --overwrite # 覆盖已存在的文件
"""

import asyncio
import os
import re
import json
import argparse
from pathlib import Path

try:
    import edge_tts
except ImportError:
    print("❌ 请先安装 edge-tts：pip install edge-tts")
    raise

# ── 声音配置 ─────────────────────────────────────────────────────────────────
VOICE_MALE   = "ja-JP-KeitaNeural"   # 男声（词汇默认）
VOICE_FEMALE = "ja-JP-NanamiNeural"  # 女声（部分寒暄）
RATE         = "-10%"                 # 略慢，便于学习
OUTPUT_BASE  = "books/audio"


# ── 从 book1.md 解析词汇 ─────────────────────────────────────────────────────

def clean_reading(raw: str) -> str:
    """清理读音列文本，提取纯假名/字母"""
    # 去掉括号内内容：（今）/ （←おきる）等
    text = re.sub(r'（[^）]*）', '', raw)
    # 去掉 HTML small 标签
    text = re.sub(r'<small>[^<]*</small>', '', text)
    # 去掉 [可选] 括号
    text = re.sub(r'\[([^\]]+)\]', r'\1', text)
    return text.strip()


def sanitize_for_filename(reading: str) -> str:
    """将读音转换为合法文件名（保留日文字符）"""
    name = reading
    # 去掉 〜 前缀（接尾词标记）
    name = name.replace('〜', '').replace('～', '')
    # 去掉方括号
    name = re.sub(r'\[[^\]]*\]', '', name)
    # 去掉圆括号及内容
    name = re.sub(r'（[^）]*）', '', name)
    name = re.sub(r'\([^)]*\)', '', name)
    # 空格 → 下划线
    name = name.replace(' ', '_').replace('　', '_')
    # 去掉不安全字符（保留日文、字母、数字、下划线、连字符）
    name = re.sub(r'[/\\:*?"<>|・]', '', name)
    return name.strip('_').strip() or 'unknown'


def speak_text_for(reading: str) -> str:
    """生成朗读用文本（去掉 〜 等语法标记）"""
    text = reading.replace('〜', '').replace('～', '')
    text = re.sub(r'\[[^\]]*\]', '', text)
    text = re.sub(r'（[^）]*）', '', text)
    text = text.strip()
    return text or reading


def parse_book1(book_path: str) -> dict:
    """
    解析 book1.md，返回每课的词汇列表。
    返回格式: {
        1: [
            {'reading': 'わたし', 'speak': 'わたし', 'filename': 'わたし'},
            ...
        ],
        ...
    }
    """
    with open(book_path, encoding='utf-8') as f:
        content = f.read()

    lessons = {}

    # 按课分割（在文件头加换行保证第1课也能匹配）
    parts = ('\n' + content).split('\n## 第')
    for part in parts[1:]:
        # 课号
        m = re.match(r'(\d+)课\n', part)
        if not m:
            continue
        lesson_num = int(m.group(1))

        vocab_items = []
        in_vocab = False
        in_greet = False

        for line in part.split('\n'):
            # 进入词汇 section
            if re.match(r'###\s+1\.\s+词汇', line):
                in_vocab = True
                in_greet = False
                continue
            # 离开词汇 section（下一个 ### section）
            if in_vocab and re.match(r'###\s+\d+', line):
                break

            if not in_vocab:
                continue

            # 检测寒暄表达（2列表格）
            if '| 表达 |' in line or '| 表达|' in line:
                in_greet = True
                continue

            if not line.startswith('|'):
                continue
            if '---' in line:
                continue

            cols = [c.strip() for c in line.split('|') if c.strip()]

            if in_greet:
                # 寒暄表达：表达 | 中文意思
                if len(cols) >= 2 and cols[0] not in ('表达', ''):
                    raw = cols[0]
                    raw = re.sub(r'<small>[^<]*</small>', '', raw)
                    raw = re.sub(r'\[([^\]]+)\]', r'\1', raw)
                    speak = raw.strip()
                    if speak and re.search(r'[\u3040-\u30ff\u4e00-\u9fff]', speak):
                        filename = sanitize_for_filename(speak)
                        vocab_items.append({
                            'reading': speak,
                            'speak':   speak,
                            'filename': filename,
                            'type': 'greeting',
                        })
                continue

            # 普通词汇：读音 | 单词 | 词性 | 中文意思
            if len(cols) < 4:
                # 如果是4列表头行则重置
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

            # 过滤掉纯数字或无意义内容
            if re.match(r'^[\d\s]+$', reading):
                continue

            speak = speak_text_for(reading)
            if not speak:
                continue

            filename = sanitize_for_filename(reading)
            vocab_items.append({
                'reading':  reading,
                'speak':    speak,
                'filename': filename,
            })

        lessons[lesson_num] = vocab_items

    return lessons


# ── 音频生成 ─────────────────────────────────────────────────────────────────

async def gen(text: str, voice: str, path: str, retries: int = 3) -> bool:
    """生成单个 MP3，失败自动重试"""
    for attempt in range(retries):
        try:
            communicate = edge_tts.Communicate(text, voice=voice, rate=RATE)
            await communicate.save(path)
            return True
        except Exception as e:
            if attempt < retries - 1:
                wait = 2 ** attempt
                print(f"    ⚠ 重试({attempt+1}) {text[:15]!r}  等待{wait}s: {e}")
                await asyncio.sleep(wait)
            else:
                print(f"    ❌ 失败: {text[:20]!r}  {e}")
    return False


async def generate_lesson(
    lesson_num: int,
    vocab_items: list,
    overwrite: bool,
    dry_run: bool,
) -> list:
    """生成单课词汇音频，返回 manifest 列表"""
    lesson_dir = Path(OUTPUT_BASE) / f"lesson_{lesson_num:02d}"
    if not dry_run:
        lesson_dir.mkdir(parents=True, exist_ok=True)

    manifest = []
    generated = 0
    skipped = 0
    failed = 0

    for item in vocab_items:
        filename = f"vocab_{item['filename']}.mp3"
        rel_path = f"lesson_{lesson_num:02d}/{filename}"
        full_path = Path(OUTPUT_BASE) / rel_path

        manifest.append({
            'reading':  item['reading'],
            'speak':    item['speak'],
            'file':     rel_path,
        })

        if dry_run:
            continue

        if full_path.exists() and not overwrite:
            skipped += 1
            continue

        ok = await gen(item['speak'], VOICE_MALE, str(full_path))
        if ok:
            generated += 1
        else:
            failed += 1

        # 小间隔，避免微软限流
        await asyncio.sleep(0.1)

    if not dry_run:
        status = f"生成:{generated}  跳过:{skipped}"
        if failed:
            status += f"  失败:{failed}"
        print(f"  ✅ 第{lesson_num:02d}课  词汇共:{len(manifest)}  {status}")
    else:
        print(f"  📋 第{lesson_num:02d}课  词汇共:{len(manifest)} 个")

    return manifest


# ── 主程序 ─────────────────────────────────────────────────────────────────

async def main_async(args):
    book_path = "books/book1.md"
    if not os.path.exists(book_path):
        print(f"❌ 找不到 {book_path}，请在项目根目录运行")
        return

    print(f"解析 {book_path} ...")
    lessons = parse_book1(book_path)
    print(f"共解析 {len(lessons)} 课\n")

    # 按 --lesson 过滤
    if args.lesson:
        if args.lesson not in lessons:
            print(f"❌ 第 {args.lesson} 课不存在（可用: {sorted(lessons)[:5]}...）")
            return
        lessons = {args.lesson: lessons[args.lesson]}

    mode_label = '[dry-run] ' if args.dry_run else ''
    print(f"{mode_label}生成 {len(lessons)} 课词汇音频")
    print(f"输出目录: {OUTPUT_BASE}/")
    print(f"声音: {VOICE_MALE}  语速: {RATE}")
    print(f"覆盖已存在: {'是' if args.overwrite else '否'}\n")

    master_manifest = {}
    total_words = 0

    for lesson_num in sorted(lessons.keys()):
        items = await generate_lesson(
            lesson_num,
            lessons[lesson_num],
            overwrite=args.overwrite,
            dry_run=args.dry_run,
        )
        master_manifest[str(lesson_num)] = items
        total_words += len(items)

    print(f"\n总计: {total_words} 个词汇音频")

    if not args.dry_run:
        manifest_data = {
            "version": "2.0",
            "description": "大家的日语 AI陪练版 - 词汇音频索引",
            "source": "books/book1.md",
            "voice": VOICE_MALE,
            "rate": RATE,
            "format": "mp3",
            "naming": "vocab_{reading}.mp3  (基于读音，与顺序无关)",
            "total_words": total_words,
            "lessons": master_manifest,
        }
        manifest_path = Path(OUTPUT_BASE) / "manifest.json"
        Path(OUTPUT_BASE).mkdir(parents=True, exist_ok=True)
        with open(manifest_path, 'w', encoding='utf-8') as f:
            json.dump(manifest_data, f, ensure_ascii=False, indent=2)
        print(f"✅ 索引已保存: {manifest_path}")
        print("\n前端 API: /api/audio/books/lesson_01/vocab_わたし.mp3")


def main():
    parser = argparse.ArgumentParser(
        description="从 books/book1.md 生成词汇音频到 books/audio/"
    )
    parser.add_argument('--lesson',    type=int,  help='只生成指定课（默认全部）')
    parser.add_argument('--dry-run',   action='store_true', help='只统计，不生成文件')
    parser.add_argument('--overwrite', action='store_true', help='覆盖已存在的音频文件')
    args = parser.parse_args()
    asyncio.run(main_async(args))


if __name__ == '__main__':
    main()
