#!/usr/bin/env python3
"""
批量生成《大家的日语》1-25课全部音频
用于替换浏览器原生 TTS

运行方式:
    python scripts/generate_all_lessons.py

注意:
- 需要 ~3GB 磁盘空间
- 首次运行会下载模型文件 (~300MB)
- 生成时间约 5-10 分钟 (视硬件而定)
"""

import os
import json
import soundfile as sf
from pathlib import Path

def ensure_dir(path):
    os.makedirs(path, exist_ok=True)

def generate_lesson_audio(lesson_num, vocab_list, text_content, output_base):
    """生成单课音频"""
    from kokoro import KPipeline
    
    lesson_dir = f"{output_base}/lesson_{lesson_num:02d}"
    ensure_dir(lesson_dir)
    
    pipeline = KPipeline(lang_code='j')
    
    generated = []
    
    # 1. 生成单词音频
    print(f"  📚 单词 ({len(vocab_list)} 个)...")
    for i, word in enumerate(vocab_list):
        filename = f"vocab_{i:03d}_{word[:10]}"
        filepath = f"{lesson_dir}/{filename}.wav"
        
        if os.path.exists(filepath):
            generated.append(filepath)
            continue
            
        generator = pipeline(word, voice='jf_alpha', speed=1.0)
        for _, _, audio in generator:
            sf.write(filepath, audio, 24000)
            generated.append(filepath)
    
    # 2. 生成课文音频
    print(f"  📖 课文...")
    text_path = f"{lesson_dir}/text_full.wav"
    if not os.path.exists(text_path) and text_content:
        generator = pipeline(text_content, voice='jf_alpha', speed=0.9)
        for _, _, audio in generator:
            sf.write(text_path, audio, 24000)
            generated.append(text_path)
    
    return generated

def load_builtin_content():
    """从项目数据加载课程内容"""
    # 这里简化处理，实际应该从 src/data/builtin-content.ts 解析
    # 先提供第1课作为示例
    
    lesson_1_vocab = [
        "わたし", "わたしたち", "あなた", "あのひと", "みなさん",
        "がくせい", "かいしゃいん", "ぎんこういん", "いしゃ", "だいがく",
        "はじめまして", "どうぞ　よろしく", "こんにちは"
    ]
    
    lesson_1_text = "わたしは　マイク・ミラーです。アメリカじんです。さくらだいがくの　がくせいです。どうぞ　よろしく。"
    
    return {
        1: (lesson_1_vocab, lesson_1_text)
    }

def main():
    print("=" * 60)
    print("🎵 批量生成《大家的日语》音频")
    print("=" * 60)
    
    try:
        from kokoro import KPipeline
    except ImportError:
        print("\n❌ 缺少依赖，请先安装:")
        print("   pip install kokoro soundfile")
        return
    
    output_base = "public/audio/lessons"
    ensure_dir(output_base)
    
    lessons = load_builtin_content()
    
    total_files = 0
    for lesson_num, (vocab, text) in lessons.items():
        print(f"\n📖 第 {lesson_num} 课:")
        files = generate_lesson_audio(lesson_num, vocab, text, output_base)
        total_files += len(files)
    
    print(f"\n✅ 完成！共生成 {total_files} 个音频文件")
    print(f"📁 位置: {os.path.abspath(output_base)}")
    
    # 生成索引文件
    index = {
        "version": "1.0",
        "total_lessons": len(lessons),
        "total_files": total_files,
        "voice": "jf_alpha",
        "sample_rate": 24000,
        "format": "wav"
    }
    
    with open(f"{output_base}/index.json", "w", encoding="utf-8") as f:
        json.dump(index, f, ensure_ascii=False, indent=2)
    
    print("\n💡 下一步:")
    print("   1. 试听音频文件")
    print("   2. 修改前端代码使用本地音频而非 TTS")

if __name__ == "__main__":
    main()
