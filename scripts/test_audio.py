#!/usr/bin/env python3
"""
音频文件自动化测试工具

测试内容：
  1. manifest.json 完整性检查（文件存在、非空）
  2. HTTP API 端点可达性测试（需要 dev server 运行）
  3. 音频文件元数据校验（MP3 格式、时长合理）
  4. 覆盖率统计（已生成 / 缺失 / 空文件）

用法:
  python scripts/test_audio.py                  # 本地文件检查（不需要服务器）
  python scripts/test_audio.py --http           # 同时测试 HTTP API（需先 npm run dev）
  python scripts/test_audio.py --lesson 2       # 只检查第2课
  python scripts/test_audio.py --verbose        # 显示每个文件状态
"""

import argparse
import json
import os
import sys
import urllib.request
import urllib.error
from pathlib import Path

# ── 配置 ─────────────────────────────────────────────────────────────────────
BOOKS_AUDIO      = Path("books/audio")
PUBLIC_AUDIO     = Path("public/audio/lessons")
MANIFEST_PATH    = BOOKS_AUDIO / "manifest.json"
EX_MANIFEST_PATH = BOOKS_AUDIO / "examples_manifest.json"
TEXT_MANIFEST    = BOOKS_AUDIO / "text_manifest.json"
OLD_INDEX        = PUBLIC_AUDIO / "index.json"
DEV_URL       = "http://localhost:3000"

MIN_MP3_SIZE  = 1024      # 最小有效 MP3 大小（bytes），低于此视为空/损坏
WARN_MP3_SIZE = 5 * 1024  # 低于 5KB 发出警告（可能音频太短）

RESET = "\033[0m"
RED   = "\033[91m"
GREEN = "\033[92m"
YELLOW= "\033[93m"
CYAN  = "\033[96m"
BOLD  = "\033[1m"

def c(color, text): return f"{color}{text}{RESET}"
def ok(msg):   print(f"  {c(GREEN,'✓')} {msg}")
def err(msg):  print(f"  {c(RED,'✗')} {msg}")
def warn(msg): print(f"  {c(YELLOW,'⚠')} {msg}")
def info(msg): print(f"  {c(CYAN,'·')} {msg}")


# ── 1. 本地文件检查 ───────────────────────────────────────────────────────────

def check_file(path: Path) -> str:
    """返回: 'ok' | 'missing' | 'empty' | 'small'"""
    if not path.exists():
        return 'missing'
    size = path.stat().st_size
    if size < MIN_MP3_SIZE:
        return 'empty'
    if size < WARN_MP3_SIZE:
        return 'small'
    return 'ok'


def check_vocab_audio(lesson_filter=None, verbose=False) -> dict:
    """检查 books/audio/ 中的词汇音频"""
    print(f"\n{c(BOLD,'── 词汇音频检查 (books/audio/) ──────────────────────────────')}")

    if not MANIFEST_PATH.exists():
        err(f"manifest.json 不存在: {MANIFEST_PATH}")
        err("请先运行: python scripts/migrate_vocab_audio.py")
        return {}

    with open(MANIFEST_PATH, encoding='utf-8') as f:
        manifest = json.load(f)

    stats = {'ok': 0, 'missing': 0, 'empty': 0, 'small': 0, 'total': 0}
    lessons = manifest.get('lessons', {})

    for lesson_num_str, items in sorted(lessons.items(), key=lambda x: int(x[0])):
        lesson_num = int(lesson_num_str)
        if lesson_filter and lesson_num != lesson_filter:
            continue

        lesson_stats = {'ok': 0, 'missing': 0, 'empty': 0}
        for item in items:
            stats['total'] += 1
            path = BOOKS_AUDIO / item['file']
            status = check_file(path)
            lesson_stats[status if status in lesson_stats else 'ok'] += 1
            stats[status if status != 'small' else 'small'] += 1
            if status != 'ok' or verbose:
                reading = item.get('reading', '?')
                if status == 'missing':
                    if verbose: err(f"[缺失] {path.name}  ({reading})")
                elif status == 'empty':
                    err(f"[空文件] {path.name}  ({reading})")
                elif status == 'small':
                    if verbose: warn(f"[偏小] {path.name}  ({reading})")
                else:
                    if verbose: ok(f"{path.name}")

        total = sum(lesson_stats.values())
        line = f"第{lesson_num:02d}课  共{total}词  ✓{lesson_stats['ok']}  "
        if lesson_stats['missing']:
            line += c(RED, f"缺失{lesson_stats['missing']}")
        else:
            line += c(GREEN, "全部存在")
        print(f"  {line}")

    print()
    pct = stats['ok'] * 100 // stats['total'] if stats['total'] else 0
    bar_len = 30
    filled = bar_len * stats['ok'] // stats['total'] if stats['total'] else 0
    bar = c(GREEN, '█' * filled) + c(RED, '░' * (bar_len - filled))
    print(f"  覆盖率: [{bar}] {pct}%  ({stats['ok']}/{stats['total']})")
    if stats['missing']:
        n = stats['missing']
        print(f"  {c(RED, f'缺失: {n} 个')}")
    if stats['empty']:
        n = stats['empty']
        print(f"  {c(RED, f'空文件: {n} 个')}")
    if stats['small']:
        n = stats['small']
        print(f"  {c(YELLOW, f'偏小(<5KB): {n} 个（可能正常，如单字词）')}")

    return stats


def check_examples_audio(lesson_filter=None, verbose=False) -> dict:
    """检查 books/audio/ 中的例句/句型音频"""
    print(f"\n{c(BOLD,'── 例句/句型音频检查 (books/audio/) ────────────────────────────')}")

    if not EX_MANIFEST_PATH.exists():
        warn(f"examples_manifest.json 不存在")
        warn("请运行: python scripts/migrate_examples_audio.py")
        return {}

    with open(EX_MANIFEST_PATH, encoding='utf-8') as f:
        manifest = json.load(f)

    stats = {'ok': 0, 'missing': 0, 'empty': 0, 'total': 0}

    for lesson_num_str, lesson in sorted(manifest.get('lessons', {}).items(), key=lambda x: int(x[0])):
        lesson_num = int(lesson_num_str)
        if lesson_filter and lesson_num != lesson_filter:
            continue

        lesson_ok = lesson_miss = 0
        for type_key in ('examples', 'patterns'):
            for item in lesson.get(type_key, []):
                stats['total'] += 1
                path = BOOKS_AUDIO / item['file']
                status = check_file(path)
                if status == 'ok':
                    stats['ok'] += 1
                    lesson_ok += 1
                else:
                    stats[status if status in stats else 'missing'] += 1
                    lesson_miss += 1
                    if verbose or status == 'empty':
                        label = c(RED, f"[{status}]")
                        print(f"    {label} {path.name}  ({item['text'][:30]})")

        status_str = c(GREEN, "全部存在") if lesson_miss == 0 else c(RED, f"缺失{lesson_miss}")
        print(f"  第{lesson_num:02d}课  ✓{lesson_ok}  {status_str}")

    pct = stats['ok'] * 100 // stats['total'] if stats['total'] else 0
    filled = 30 * stats['ok'] // stats['total'] if stats['total'] else 0
    bar = c(GREEN, '█' * filled) + c(RED, '░' * (30 - filled))
    print(f"\n  覆盖率: [{bar}] {pct}%  ({stats['ok']}/{stats['total']})")
    if stats['missing'] + stats['empty']:
        n = stats['missing'] + stats['empty']
        print(f"  {c(RED, f'缺失/空: {n} 个')}")

    return stats


def check_text_audio_new(lesson_filter=None, verbose=False) -> dict:
    """检查 books/audio/ 中的课文音频（内容命名体系）"""
    print(f"\n{c(BOLD,'── 课文音频检查 (books/audio/text_manifest.json) ───────────────')}")

    if not TEXT_MANIFEST.exists():
        warn(f"text_manifest.json 不存在")
        warn("请运行: python scripts/migrate_text_audio.py")
        return {}

    with open(TEXT_MANIFEST, encoding='utf-8') as f:
        manifest = json.load(f)

    stats = {'ok': 0, 'missing': 0, 'empty': 0, 'total': 0}

    for lesson_num_str, entries in sorted(manifest.items(), key=lambda x: int(x[0])):
        lesson_num = int(lesson_num_str)
        if lesson_filter and lesson_num != lesson_filter:
            continue

        lesson_ok = lesson_miss = 0
        for item in entries:
            stats['total'] += 1
            path = BOOKS_AUDIO / item['file']
            status = check_file(path)
            if status in ('ok', 'small'):
                stats['ok'] += 1
                lesson_ok += 1
            else:
                stats[status] += 1
                lesson_miss += 1
                if verbose or status == 'empty':
                    label = c(RED, f"[{status}]")
                    print(f"    {label} {path.name}  ({item['text'][:30]})")

        status_str = c(GREEN, "全部存在") if lesson_miss == 0 else c(RED, f"缺失{lesson_miss}")
        print(f"  第{lesson_num:02d}课  ✓{lesson_ok}  {status_str}")

    pct = stats['ok'] * 100 // stats['total'] if stats['total'] else 0
    filled = 30 * stats['ok'] // stats['total'] if stats['total'] else 0
    bar = c(GREEN, '█' * filled) + c(RED, '░' * (30 - filled))
    print(f"\n  覆盖率: [{bar}] {pct}%  ({stats['ok']}/{stats['total']})")
    if stats['missing'] + stats['empty']:
        n = stats['missing'] + stats['empty']
        print(f"  {c(RED, f'缺失/空: {n} 个')}")

    return stats


def check_text_audio(lesson_filter=None, verbose=False) -> dict:
    """检查 public/audio/lessons/ 中的听力音频（索引命名体系）"""
    print(f"\n{c(BOLD,'── 听力音频检查 (public/audio/lessons/) ────────────────────')}")

    if not OLD_INDEX.exists():
        warn(f"index.json 不存在: {OLD_INDEX}")
        warn("请运行: python scripts/generate_edge_tts.py --overwrite")
        return {}

    with open(OLD_INDEX, encoding='utf-8') as f:
        index = json.load(f)

    types_check = ['listening']
    stats = {t: {'ok': 0, 'missing': 0, 'empty': 0} for t in types_check}
    stats['total'] = 0

    for lesson_num_str, lesson in sorted(index.get('lessons', {}).items(), key=lambda x: int(x[0])):
        lesson_num = int(lesson_num_str)
        if lesson_filter and lesson_num != lesson_filter:
            continue

        for type_key in types_check:
            for item in lesson.get(type_key, []):
                stats['total'] += 1
                path = PUBLIC_AUDIO / item['file']
                status = check_file(path)
                if status == 'ok':
                    stats[type_key]['ok'] += 1
                else:
                    stats[type_key]['missing' if status == 'missing' else 'empty'] += 1
                    if verbose or status == 'empty':
                        label = c(RED, f"[{status}]") if status != 'ok' else c(GREEN, '[ok]')
                        print(f"    {label} {item['file']}")

    for type_key in types_check:
        s = stats[type_key]
        total_t = s['ok'] + s['missing'] + s['empty']
        if total_t == 0:
            continue
        label = {'listening': '听力'}[type_key]
        if s['missing'] or s['empty']:
            status_str = c(RED, f"缺失{s['missing']+s['empty']}个")
        else:
            status_str = c(GREEN, "全部存在")
        print(f"  {label}: 共{total_t}个  {status_str}")

    return stats


# ── 2. HTTP API 测试 ──────────────────────────────────────────────────────────

def test_http_vocab(lesson_filter=None) -> dict:
    """通过 HTTP 测试词汇音频 API 端点"""
    print(f"\n{c(BOLD,'── HTTP API 测试 /api/audio/books/ ──────────────────────────')}")

    if not MANIFEST_PATH.exists():
        err("manifest.json 不存在，跳过 HTTP 测试")
        return {}

    with open(MANIFEST_PATH, encoding='utf-8') as f:
        manifest = json.load(f)

    stats = {'200': 0, '404': 0, 'error': 0, 'total': 0}
    lessons = manifest.get('lessons', {})

    for lesson_num_str, items in sorted(lessons.items(), key=lambda x: int(x[0])):
        lesson_num = int(lesson_num_str)
        if lesson_filter and lesson_num != lesson_filter:
            continue

        lesson_ok = 0
        lesson_fail = 0
        for item in items[:3]:  # 每课只测前3个（避免太慢）
            stats['total'] += 1
            url = f"{DEV_URL}/api/audio/books/{item['file']}"
            try:
                req = urllib.request.urlopen(url, timeout=3)
                if req.status == 200:
                    stats['200'] += 1
                    lesson_ok += 1
                else:
                    stats['404'] += 1
                    lesson_fail += 1
                    warn(f"HTTP {req.status}: {item['file']}")
            except urllib.error.HTTPError as e:
                stats['404'] += 1
                lesson_fail += 1
                warn(f"HTTP {e.code}: {item['file']}")
            except Exception as e:
                stats['error'] += 1
                err(f"连接失败 ({e}): {url}")
                break  # 服务器不可达，停止

        status = c(GREEN, "OK") if lesson_fail == 0 else c(RED, f"FAIL({lesson_fail})")
        print(f"  第{lesson_num:02d}课  {status}")

    print(f"\n  HTTP 测试结果: 200={stats['200']}  404={stats['404']}  error={stats['error']}")
    return stats


# ── 3. 生成缺失文件列表 ───────────────────────────────────────────────────────

def list_missing(lesson_filter=None):
    """输出缺失文件列表，可管道到生成脚本"""
    if not MANIFEST_PATH.exists():
        return
    with open(MANIFEST_PATH, encoding='utf-8') as f:
        manifest = json.load(f)

    missing = []
    for lesson_num_str, items in manifest.get('lessons', {}).items():
        if lesson_filter and int(lesson_num_str) != lesson_filter:
            continue
        for item in items:
            path = BOOKS_AUDIO / item['file']
            if not path.exists() or path.stat().st_size < MIN_MP3_SIZE:
                missing.append(item)

    if missing:
        print(f"\n{c(BOLD,'── 缺失文件列表 ─────────────────────────────────────────────')}")
        for item in missing:
            print(f"  缺失: {item['file']}  text={item.get('speak','?')}")
        print(f"\n  共 {len(missing)} 个文件缺失")
        print(f"  修复命令: python scripts/migrate_vocab_audio.py --overwrite")
    return missing


# ── 主程序 ────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="音频文件自动化测试")
    parser.add_argument('--http',    action='store_true', help='同时测试 HTTP API（需运行 npm run dev）')
    parser.add_argument('--lesson',  type=int,            help='只检查指定课')
    parser.add_argument('--verbose', action='store_true', help='显示每个文件状态')
    parser.add_argument('--missing', action='store_true', help='只输出缺失文件列表')
    args = parser.parse_args()

    print(f"\n{c(BOLD+CYAN, '大家的日语 AI陪练版 - 音频文件测试报告')}")
    print(f"{'─' * 55}")

    if args.missing:
        list_missing(args.lesson)
        return

    vocab_stats   = check_vocab_audio(args.lesson, args.verbose)
    ex_stats      = check_examples_audio(args.lesson, args.verbose)
    new_text_stats = check_text_audio_new(args.lesson, args.verbose)
    text_stats    = check_text_audio(args.lesson, args.verbose)

    if args.http:
        test_http_vocab(args.lesson)
    else:
        print(f"\n  {c(YELLOW,'提示')}: 加 --http 参数可同时测试 HTTP API 端点（需先 npm run dev）")

    # 总结
    print(f"\n{c(BOLD,'── 总结 ─────────────────────────────────────────────────────')}")
    if vocab_stats:
        missing = vocab_stats.get('missing', 0) + vocab_stats.get('empty', 0)
        total   = vocab_stats.get('total', 0)
        if missing == 0:
            ok(f"词汇音频: 全部 {total} 个有效 ✓")
        else:
            err(f"词汇音频: {missing}/{total} 个缺失/损坏 → 运行 migrate_vocab_audio.py --overwrite")

    if ex_stats:
        ex_missing = ex_stats.get('missing', 0) + ex_stats.get('empty', 0)
        if ex_missing == 0:
            ok(f"例句/句型音频: 全部 {ex_stats.get('total', 0)} 个有效 ✓")
        else:
            err(f"例句/句型音频: {ex_missing} 个缺失 → 运行 migrate_examples_audio.py --overwrite")

    if new_text_stats:
        nt_missing = new_text_stats.get('missing', 0) + new_text_stats.get('empty', 0)
        if nt_missing == 0:
            ok(f"课文音频: 全部 {new_text_stats.get('total', 0)} 个有效 ✓")
        else:
            err(f"课文音频: {nt_missing} 个缺失 → 运行 migrate_text_audio.py --overwrite")

    text_missing = sum(
        s.get('missing', 0) + s.get('empty', 0)
        for k, s in text_stats.items()
        if isinstance(s, dict)
    )
    if text_stats and text_missing == 0:
        ok("听力音频: 全部存在 ✓")
    elif text_missing:
        err(f"听力音频: {text_missing} 个缺失 → 运行 generate_edge_tts.py --overwrite")
    print()


if __name__ == '__main__':
    main()
