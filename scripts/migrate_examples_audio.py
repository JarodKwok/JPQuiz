#!/usr/bin/env python3
"""
将例句（example）和文型（pattern）音频迁移到 books/audio/ 内容命名体系。

命名规则（基于文本内容的 MD5 hash，与顺序无关）：
  books/audio/lesson_01/example_a3f2b8c1.mp3
  books/audio/lesson_01/pattern_d4e5f6a7.mp3

算法：
  1. 从 public/audio/lessons/index.json 建立 text -> 旧文件 全局映射
  2. 从 src/data/builtin-content.ts 提取当前各课 examples/patterns
  3. 对每条内容：文本匹配到旧文件 → 复制；否则 → Edge TTS 生成
  4. 写 books/audio/examples_manifest.json

用法:
  source venv313/bin/activate
  python scripts/migrate_examples_audio.py            # 全部25课
  python scripts/migrate_examples_audio.py --lesson 1 # 仅第1课
  python scripts/migrate_examples_audio.py --dry-run  # 仅统计
  python scripts/migrate_examples_audio.py --overwrite
"""

import asyncio
import hashlib  # noqa: F401 (unused after switch to sha256)
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
SRC_BASE      = Path("public/audio/lessons")
DST_BASE      = Path("books/audio")
OLD_INDEX     = SRC_BASE / "index.json"
TS_PATH       = "src/data/builtin-content.ts"
MANIFEST_PATH = DST_BASE / "examples_manifest.json"

VOICE_MALE    = "ja-JP-KeitaNeural"
RATE          = "-10%"


# ── Hash 命名 ─────────────────────────────────────────────────────────────────

def text_hash(text: str) -> str:
    """SHA-256 前 8 位，与前端 crypto.subtle.digest('SHA-256') 一致"""
    import hashlib
    return hashlib.sha256(text.encode('utf-8')).hexdigest()[:8]


# ── 从 builtin-content.ts 提取内容 ───────────────────────────────────────────

def is_japanese(text: str) -> bool:
    return bool(re.search(r'[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]', text))


def extract_from_ts(ts_path: str) -> dict:
    """提取各课 examples 和 patterns（与 generate_edge_tts.py 逻辑一致）"""
    with open(ts_path, encoding='utf-8') as f:
        content = f.read()

    header_re = re.compile(r'//\s*第\s*(\d+)\s*课')
    positions = [(int(m.group(1)), m.start()) for m in header_re.finditer(content)]

    lessons = {}
    for idx, (lesson_num, start) in enumerate(positions):
        end = positions[idx + 1][1] if idx + 1 < len(positions) else len(content)
        chunk = content[start:end]

        examples = [t for t in re.findall(r'\be\("([^"]+)"', chunk) if is_japanese(t)]
        # patterns: p("id","pattern","meaning","structure","sampleJapanese",...)
        patterns = [t for t in re.findall(
            r'\bp\("[^"]*",\s*"[^"]*",\s*"[^"]*",\s*"[^"]*",\s*"([^"]+)"', chunk
        ) if is_japanese(t)]

        lessons[lesson_num] = {'examples': examples, 'patterns': patterns}

    return lessons


# ── 旧索引查找表 ──────────────────────────────────────────────────────────────

def build_old_lookup(index_path: Path) -> dict:
    """建立 text -> 绝对路径 的全局映射（examples + patterns）"""
    if not index_path.exists():
        return {}
    with open(index_path, encoding='utf-8') as f:
        data = json.load(f)
    lookup = {}
    for lesson_data in data.get('lessons', {}).values():
        for type_key in ('examples', 'patterns'):
            for entry in lesson_data.get(type_key, []):
                text = entry.get('text', '').strip()
                rel  = entry.get('file', '')
                if text and rel and text not in lookup:
                    lookup[text] = SRC_BASE / Path(rel)
    return lookup


# ── TTS 生成 ──────────────────────────────────────────────────────────────────

async def gen_tts(text: str, path: Path, retries: int = 3) -> bool:
    for attempt in range(retries):
        try:
            communicate = edge_tts.Communicate(text, voice=VOICE_MALE, rate=RATE)
            await communicate.save(str(path))
            if path.exists() and path.stat().st_size > 512:
                return True
            raise RuntimeError("生成文件为空")
        except Exception as e:
            if attempt < retries - 1:
                wait = 2 ** attempt
                print(f"    ⚠ 重试({attempt+1}) {text[:20]!r} 等待{wait}s: {e}")
                await asyncio.sleep(wait)
            else:
                print(f"    ❌ TTS失败: {text[:25]!r}  {e}")
    return False


# ── 处理单课 ──────────────────────────────────────────────────────────────────

async def migrate_lesson(
    lesson_num: int,
    content: dict,
    old_lookup: dict,
    overwrite: bool,
    dry_run: bool,
) -> dict:
    lesson_dir = DST_BASE / f"lesson_{lesson_num:02d}"
    if not dry_run:
        lesson_dir.mkdir(parents=True, exist_ok=True)

    result = {'examples': [], 'patterns': []}
    stats = {'copied': 0, 'generated': 0, 'skipped': 0, 'failed': 0}

    for type_key in ('examples', 'patterns'):
        prefix = 'example' if type_key == 'examples' else 'pattern'
        for text in content[type_key]:
            h = text_hash(text)
            dst_name = f"{prefix}_{h}.mp3"
            dst_path = lesson_dir / dst_name
            rel_path = f"lesson_{lesson_num:02d}/{dst_name}"

            result[type_key].append({'text': text, 'hash': h, 'file': rel_path})

            if dry_run:
                src = old_lookup.get(text)
                tag = "→复用" if (src and src.exists()) else "→新TTS"
                print(f"    [{prefix}] {tag}  {text[:40]}")
                continue

            if dst_path.exists() and not overwrite:
                stats['skipped'] += 1
                continue

            src = old_lookup.get(text)
            if src and src.exists() and src.stat().st_size > 512:
                shutil.copy2(src, dst_path)
                stats['copied'] += 1
            else:
                ok = await gen_tts(text, dst_path)
                if ok:
                    stats['generated'] += 1
                    await asyncio.sleep(0.15)
                else:
                    stats['failed'] += 1

    if not dry_run:
        ex_count = len(result['examples'])
        pt_count = len(result['patterns'])
        parts = [f"复用:{stats['copied']}", f"新TTS:{stats['generated']}", f"跳过:{stats['skipped']}"]
        if stats['failed']:
            parts.append(f"失败:{stats['failed']}")
        print(f"  ✅ 第{lesson_num:02d}课  例句:{ex_count}  句型:{pt_count}  {' '.join(parts)}")

    result['stats'] = stats
    return result


# ── 主程序 ────────────────────────────────────────────────────────────────────

async def main_async(args):
    if not os.path.exists(TS_PATH):
        print(f"❌ 找不到 {TS_PATH}")
        return

    print(f"提取 {TS_PATH} 例句/句型 ...")
    lessons = extract_from_ts(TS_PATH)
    total_ex = sum(len(v['examples']) for v in lessons.values())
    total_pt = sum(len(v['patterns']) for v in lessons.values())
    print(f"共 {len(lessons)} 课  例句:{total_ex}  句型:{total_pt}")

    print(f"读取旧音频索引 {OLD_INDEX} ...")
    old_lookup = build_old_lookup(OLD_INDEX)
    print(f"旧索引可用条目: {len(old_lookup)} 条\n")

    if args.lesson:
        if args.lesson not in lessons:
            print(f"❌ 第 {args.lesson} 课不存在")
            return
        lessons = {args.lesson: lessons[args.lesson]}

    mode = '[dry-run] ' if args.dry_run else ''
    print(f"{mode}迁移 {len(lessons)} 课  例句+句型音频")
    print(f"来源: {SRC_BASE}/  →  目标: {DST_BASE}/")
    print(f"命名: {{prefix}}_{{md5[:8]}}.mp3  （基于内容，与顺序无关）")
    print(f"声音: {VOICE_MALE}  语速: {RATE}\n")

    master = {}
    totals = {'copied': 0, 'generated': 0, 'skipped': 0, 'failed': 0}

    for lesson_num in sorted(lessons.keys()):
        r = await migrate_lesson(
            lesson_num, lessons[lesson_num], old_lookup,
            overwrite=args.overwrite, dry_run=args.dry_run,
        )
        master[str(lesson_num)] = {'examples': r['examples'], 'patterns': r['patterns']}
        for k in totals:
            totals[k] += r['stats'].get(k, 0)

    print(f"\n总计:")
    print(f"  复用旧文件: {totals['copied']}")
    print(f"  新生成TTS:  {totals['generated']}")
    print(f"  跳过(已存在): {totals['skipped']}")
    if totals['failed']:
        print(f"  ❌ 失败:   {totals['failed']}")

    if not args.dry_run:
        # 单课模式合并已有 manifest
        if args.lesson and MANIFEST_PATH.exists():
            with open(MANIFEST_PATH, encoding='utf-8') as f:
                existing = json.load(f)
            existing_lessons = existing.get('lessons', {})
            existing_lessons.update(master)
            master = existing_lessons

        DST_BASE.mkdir(parents=True, exist_ok=True)
        manifest_data = {
            "version": "1.0",
            "description": "大家的日语 AI陪练版 - 例句/句型音频索引（内容命名体系）",
            "source": "src/data/builtin-content.ts",
            "voice": VOICE_MALE,
            "rate": RATE,
            "format": "mp3",
            "naming": "{prefix}_{md5[:8]}.mp3  基于文本内容，与顺序无关",
            "lessons": master,
        }
        with open(MANIFEST_PATH, 'w', encoding='utf-8') as f:
            json.dump(manifest_data, f, ensure_ascii=False, indent=2)
        print(f"\n✅ manifest 已保存: {MANIFEST_PATH}")
        print("前端访问路径: /api/audio/books/lesson_01/example_a3f2b8c1.mp3")


def main():
    parser = argparse.ArgumentParser(description="例句/句型音频迁移到 books/audio/")
    parser.add_argument('--lesson',    type=int,  help='只处理指定课（默认全部）')
    parser.add_argument('--dry-run',   action='store_true', help='只统计，不操作文件')
    parser.add_argument('--overwrite', action='store_true', help='覆盖已存在的目标文件')
    args = parser.parse_args()
    asyncio.run(main_async(args))


if __name__ == '__main__':
    main()
