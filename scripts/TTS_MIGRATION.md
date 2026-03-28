# Kokoro TTS 迁移指南

将 JPQuiz 的语音从浏览器原生 TTS 升级为 Kokoro TTS（本地神经网络）。

## 音质对比

| 方案 | 自然度 | 费用 | 延迟 | 离线可用 |
|------|--------|------|------|----------|
| 浏览器原生 TTS | ⭐⭐☆☆☆ | 免费 | 低 | ✅ |
| **Kokoro TTS** | **⭐⭐⭐⭐☆** | **免费** | **低** | **✅** |
| OpenAI TTS | ⭐⭐⭐⭐☆ | $15/百万字符 | 中 | ❌ |
| ElevenLabs | ⭐⭐⭐⭐⭐ | $206/百万字符 | 低 | ❌ |

Kokoro 音质接近 OpenAI TTS，明显优于浏览器原生语音。

## 快速开始

### 1. 安装依赖

```bash
# 创建 Python 虚拟环境（推荐）
python3 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 安装 Kokoro
pip install kokoro soundfile
```

### 2. 生成测试样本

```bash
python scripts/generate_kokoro_samples.py
```

生成的文件在 `public/audio/kokoro_samples/` 目录。

### 3. 试听对比

打开生成的 `.wav` 文件，与当前浏览器的朗读效果对比。

## 批量生成全部课程

```bash
python scripts/generate_all_lessons.py
```

这会生成 1-25 课的全部单词和课文音频，约需 5-10 分钟。

## 前端集成

生成音频后，修改前端代码使用本地音频文件：

```typescript
// 替换原来的 speak() 函数
const speak = (text: string) => {
  // 从预生成的音频文件播放
  const audio = new Audio(`/audio/lessons/lesson_01/vocab_001.wav`);
  audio.play();
};
```

完整的前端集成代码见 `src/services/audio.ts`（待实现）。

## 注意事项

1. **模型大小**: 首次运行会自动下载 ~300MB 模型文件
2. **硬件要求**: CPU 即可运行，有 NVIDIA GPU 更快
3. **日语支持**: 需要安装 `misaki[ja]` 依赖（已包含在 kokoro 中）

## 语音选项

日语目前可用的音色:
- `jf_alpha` - 女声（推荐）
- `jm_alpha` - 男声

## 问题排查

**Q: 提示缺少 espeak?**
```bash
# macOS
brew install espeak-ng

# Ubuntu/Debian
sudo apt-get install espeak-ng

# Windows
# 下载安装包: https://github.com/espeak-ng/espeak-ng/releases
```

**Q: 生成音频太慢?**
- 有 GPU 时会自动使用 CUDA 加速
- 也可接受，因为只需生成一次
