#!/usr/bin/env python3
"""
Kokoro TTS 日语样本生成脚本
用于测试日语语音质量

使用方法:
1. 安装依赖: pip install kokoro soundfile
2. 运行: python scripts/generate_kokoro_samples.py
3. 生成的音频在 public/audio/kokoro_samples/ 目录
"""

import os
import soundfile as sf

def ensure_dir(path):
    os.makedirs(path, exist_ok=True)

def generate_japanese_samples():
    try:
        from kokoro import KPipeline
    except ImportError:
        print("❌ 请先安装依赖: pip install kokoro soundfile")
        return

    # 输出目录
    output_dir = "public/audio/kokoro_samples"
    ensure_dir(output_dir)
    
    print("🎵 正在加载 Kokoro TTS 模型...")
    # 'j' = 日语
    pipeline = KPipeline(lang_code='j')
    
    # 测试样本：大家的日语 第1课内容
    samples = [
        ("vocabulary_hello", "はじめまして"),
        ("vocabulary_i", "わたし"),
        ("vocabulary_student", "がくせい"),
        ("pattern_intro", "わたしは　マイク・ミラーです"),
        ("pattern_country", "にほんじんです"),
        ("pattern_age", "きゅうさいです"),
        ("sentence_full", "わたしは　にほんの　がくせいです"),
    ]
    
    print(f"📝 将生成 {len(samples)} 个日语样本...\n")
    
    for filename, text in samples:
        print(f"🔊 生成: {text}")
        
        # 生成音频
        generator = pipeline(text, voice='jf_alpha', speed=1.0)
        
        for i, (gs, ps, audio) in enumerate(generator):
            filepath = f"{output_dir}/{filename}.wav"
            sf.write(filepath, audio, 24000)
            print(f"   ✅ 已保存: {filepath}")
    
    print(f"\n🎉 完成！共生成 {len(samples)} 个样本")
    print(f"📁 位置: {os.path.abspath(output_dir)}")

def compare_with_browser_tts():
    """生成对比用的长句子"""
    try:
        from kokoro import KPipeline
    except ImportError:
        return
        
    output_dir = "public/audio/kokoro_samples"
    ensure_dir(output_dir)
    
    pipeline = KPipeline(lang_code='j')
    
    # 第1课完整对话
    long_text = "わたしは　マイク・ミラーです。アメリカじんです。さくらだいがくの　がくせいです。いちねんせいです。じゅうきゅうさいです。どうぞ　よろしく。"
    
    print(f"\n🔊 生成课文朗读...")
    generator = pipeline(long_text, voice='jf_alpha', speed=0.9)
    
    for i, (gs, ps, audio) in enumerate(generator):
        filepath = f"{output_dir}/lesson1_text.wav"
        sf.write(filepath, audio, 24000)
        print(f"   ✅ 已保存: {filepath}")
    
    print("\n💡 试听建议:")
    print("   1. 打开 public/audio/kokoro_samples/ 目录")
    print("   2. 用播放器试听 .wav 文件")
    print("   3. 与浏览器原生 TTS 对比")

if __name__ == "__main__":
    print("=" * 50)
    print("🎯 Kokoro TTS 日语样本生成器")
    print("=" * 50)
    
    generate_japanese_samples()
    compare_with_browser_tts()
    
    print("\n✨ 提示: 如果满意这个音质，可以运行 generate_all_lessons.py 生成全部课程音频")
