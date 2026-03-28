#!/usr/bin/env python3
"""
使用 OpenAI TTS API 批量生成日语音频
音质自然，费用极低（25课估计约 $0.5）

使用方法:
    source venv313/bin/activate
    python scripts/generate_openai_tts.py --api-key sk-xxx
    或设置环境变量 OPENAI_API_KEY=sk-xxx

参数:
    --api-key     OpenAI API key（或 OPENAI_API_KEY 环境变量）
    --base-url    API base URL，默认 OpenAI 官方（可改为兼容服务）
    --voice       声音：shimmer/nova/alloy/echo/fable/onyx（默认 shimmer）
    --speed       语速 0.25-4.0（默认 0.85，略慢方便学习）
    --lesson      只生成指定课（默认全部 1-25）
    --dry-run     只统计不生成（预估费用）
"""

import os
import re
import json
import argparse
from pathlib import Path

def ensure_dir(path):
    Path(path).mkdir(parents=True, exist_ok=True)

def is_japanese(text: str) -> bool:
    """判断是否包含日文字符"""
    return bool(re.search(r'[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]', text))

def extract_lesson_content(ts_content: str) -> dict:
    """
    从 builtin-content.ts 提取各课的日语文本。
    按课号分段，提取词汇单词、例句、课文行、听力句。
    """
    lessons = {}

    # 按课号分段（// 第X课 注释）
    lesson_header = re.compile(r'//\s*第\s*(\d+)\s*课')
    positions = [(int(m.group(1)), m.start()) for m in lesson_header.finditer(ts_content)]

    if not positions:
        print("⚠️  未找到课程分段注释，尝试整体解析...")
        positions = [(0, 0)]

    for idx, (lesson_num, start) in enumerate(positions):
        end = positions[idx + 1][1] if idx + 1 < len(positions) else len(ts_content)
        chunk = ts_content[start:end]

        # 提取词汇：v("word", "reading", "meaning", ...) 第1个参数是单词
        vocab = re.findall(r'\bv\("([^"]+)"', chunk)

        # 提取例句：e("japanese", ...) 第1个参数是日语句子
        examples = re.findall(r'\be\("([^"]+)"', chunk)

        # 提取课文行：line("japanese", ...) 第1个参数是日语句子
        lines = re.findall(r'\bline\("([^"]+)"', chunk)

        # 提取听力：q("text", ...) 第1个参数是听力文本
        listening = re.findall(r'\bq\("([^"]+)"', chunk)

        # 只保留含日文的文本
        lessons[lesson_num] = {
            'vocab':     [t for t in vocab     if is_japanese(t)],
            'examples':  [t for t in examples  if is_japanese(t)],
            'lines':     [t for t in lines     if is_japanese(t)],
            'listening': [t for t in listening if is_japanese(t)],
        }

    return lessons

def generate_audio(client, text: str, output_path: str, voice: str, speed: float, dry_run: bool) -> int:
    """
    生成单个音频文件，返回文本字符数（用于统计费用）。
    已存在的文件跳过。
    """
    if os.path.exists(output_path):
        return 0

    if dry_run:
        return len(text)

    response = client.audio.speech.create(
        model="tts-1",
        voice=voice,
        input=text,
        speed=speed,
        response_format="mp3",
    )

    ensure_dir(os.path.dirname(output_path))
    response.stream_to_file(output_path)
    return len(text)

def main():
    parser = argparse.ArgumentParser(description="OpenAI TTS 日语音频批量生成器")
    parser.add_argument("--api-key",  help="OpenAI API key")
    parser.add_argument("--base-url", default=None, help="API base URL（兼容 OpenAI 协议的服务）")
    parser.add_argument("--voice",    default="shimmer",
                        choices=["alloy", "echo", "fable", "onyx", "nova", "shimmer"],
                        help="TTS 声音（推荐 shimmer 或 nova，日语效果好）")
    parser.add_argument("--speed",    type=float, default=0.85, help="语速 0.25-4.0")
    parser.add_argument("--lesson",   type=int, help="只生成指定课号（默认全部）")
    parser.add_argument("--dry-run",  action="store_true", help="只统计不生成，预估费用")
    args = parser.parse_args()

    # ── API 客户端 ──────────────────────────────────────────────────
    api_key = args.api_key or os.environ.get("OPENAI_API_KEY")
    if not api_key and not args.dry_run:
        print("❌ 需要 API key：--api-key sk-xxx 或设置环境变量 OPENAI_API_KEY")
        return

    from openai import OpenAI
    client_kwargs = {"api_key": api_key or "dummy"}
    if args.base_url:
        client_kwargs["base_url"] = args.base_url
    client = OpenAI(**client_kwargs)

    # ── 读取课程数据 ────────────────────────────────────────────────
    ts_path = "src/data/builtin-content.ts"
    if not os.path.exists(ts_path):
        print(f"❌ 找不到文件: {ts_path}，请在项目根目录运行")
        return

    with open(ts_path, encoding="utf-8") as f:
        ts_content = f.read()

    lessons = extract_lesson_content(ts_content)

    if args.lesson:
        if args.lesson not in lessons:
            print(f"❌ 第 {args.lesson} 课不存在")
            return
        lessons = {args.lesson: lessons[args.lesson]}

    # ── 生成音频 ────────────────────────────────────────────────────
    output_base = "public/audio/lessons"
    if not args.dry_run:
        ensure_dir(output_base)

    if args.dry_run:
        print("📊 [dry-run] 统计模式，不实际生成文件\n")
    else:
        print(f"🎙️  声音: {args.voice}  语速: {args.speed}")
        print(f"📁 输出: {os.path.abspath(output_base)}\n")

    total_files = 0
    total_chars = 0
    lesson_index = {}  # 用于生成 index.json

    for lesson_num in sorted(lessons.keys()):
        content = lessons[lesson_num]
        lesson_dir = f"{output_base}/lesson_{lesson_num:02d}"
        lesson_entry = {"vocab": [], "examples": [], "lines": [], "listening": []}

        v_count  = len(content['vocab'])
        ex_count = len(content['examples'])
        ln_count = len(content['lines'])
        li_count = len(content['listening'])

        print(f"📖 第 {lesson_num:02d} 课  "
              f"词汇:{v_count}  例句:{ex_count}  课文:{ln_count}行  听力:{li_count}")

        # 词汇
        for i, word in enumerate(content['vocab']):
            rel_path = f"lesson_{lesson_num:02d}/vocab_{i:03d}.mp3"
            full_path = f"{output_base}/{rel_path}"
            chars = generate_audio(client, word, full_path, args.voice, args.speed, args.dry_run)
            total_chars += chars
            total_files += 1
            lesson_entry["vocab"].append({"text": word, "file": rel_path})

        # 例句
        for i, sentence in enumerate(content['examples']):
            rel_path = f"lesson_{lesson_num:02d}/example_{i:03d}.mp3"
            full_path = f"{output_base}/{rel_path}"
            chars = generate_audio(client, sentence, full_path, args.voice, args.speed, args.dry_run)
            total_chars += chars
            total_files += 1
            lesson_entry["examples"].append({"text": sentence, "file": rel_path})

        # 课文行
        for i, line_text in enumerate(content['lines']):
            rel_path = f"lesson_{lesson_num:02d}/text_{i:03d}.mp3"
            full_path = f"{output_base}/{rel_path}"
            chars = generate_audio(client, line_text, full_path, args.voice, args.speed, args.dry_run)
            total_chars += chars
            total_files += 1
            lesson_entry["lines"].append({"text": line_text, "file": rel_path})

        # 听力
        for i, li_text in enumerate(content['listening']):
            rel_path = f"lesson_{lesson_num:02d}/listening_{i:03d}.mp3"
            full_path = f"{output_base}/{rel_path}"
            chars = generate_audio(client, li_text, full_path, args.voice, args.speed, args.dry_run)
            total_chars += chars
            total_files += 1
            lesson_entry["listening"].append({"text": li_text, "file": rel_path})

        lesson_index[str(lesson_num)] = lesson_entry

    # ── 输出汇总 ────────────────────────────────────────────────────
    # OpenAI tts-1: $15 / 1M chars
    estimated_cost = total_chars / 1_000_000 * 15

    print(f"\n{'📊 统计' if args.dry_run else '✅ 完成'}")
    print(f"   音频文件数: {total_files}")
    print(f"   总字符数:   {total_chars:,}")
    print(f"   预估费用:   ${estimated_cost:.3f} (OpenAI tts-1 $15/百万字符)")

    if not args.dry_run:
        # 保存索引文件（前端用来查找音频路径）
        index = {
            "version": "1.0",
            "voice": args.voice,
            "speed": args.speed,
            "format": "mp3",
            "total_files": total_files,
            "lessons": lesson_index,
        }
        index_path = f"{output_base}/index.json"
        with open(index_path, "w", encoding="utf-8") as f:
            json.dump(index, f, ensure_ascii=False, indent=2)

        print(f"\n💡 下一步：运行前端集成")
        print(f"   音频位置: {os.path.abspath(output_base)}")
        print(f"   索引文件: {os.path.abspath(index_path)}")

if __name__ == "__main__":
    main()
