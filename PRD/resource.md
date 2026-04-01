# 大家的日语 AI陪练 — 资源衔接文档

> 描述应用所有数据资源的来源、处理流程、存储位置及前端衔接方式。
> 更新时间：2026-04-01

---

## 一、资源总览

```
books/book1.md           ← 唯一权威教材来源（5149 行，25 课）
    │
    ├─→ scripts/parse-book1.mjs
    │       └─→ src/data/builtin-content.ts   ← 应用内容数据层（221KB）
    │
    ├─→ scripts/migrate_vocab_audio.py
    │       └─→ books/audio/lesson_XX/vocab_*.mp3      ← 词汇音频
    │
    └─→ scripts/generate_edge_tts.py（读 builtin-content.ts）
            └─→ public/audio/lessons/lesson_XX/*.mp3   ← 课文/听力音频

src/data/builtin-content.ts
    └─→ scripts/migrate_examples_audio.py
            └─→ books/audio/lesson_XX/example_*.mp3    ← 例句音频
            └─→ books/audio/lesson_XX/pattern_*.mp3    ← 句型音频
```

---

## 二、教材来源：`books/book1.md`

| 属性 | 值 |
|------|----|
| 路径 | `books/book1.md` |
| 大小 | 188KB / 5149 行 |
| 覆盖范围 | 第 1～25 课（《大家的日语》初级 I 全册） |
| 格式 | Markdown（`## 第N课` 分节，`### 1. 词汇` 等子节） |

### 各课内容结构

```markdown
## 第1课

### 1. 词汇
| 读音 | 单词 | 词性 | 中文意思 |
| わたし | 私 | 名 | 我 |
...

### 2. 语法
#### 语法1：名词は 名词です
说明...
- ① 例句
  - 翻译

### 3. 例句（例文）
1. わたしは マイク・ミラーです。（我是迈克·米勒。）
...

### 4. 课文
**本文**
```text
ミラー：はじめまして。...
```

**译文**
```text
米勒：初次见面。...
```

### 5. 听力（部分课有）
...
```

---

## 三、内容数据层：`src/data/builtin-content.ts`

| 属性 | 值 |
|------|----|
| 路径 | `src/data/builtin-content.ts` |
| 大小 | 221KB / 2267 行 |
| 生成方式 | `node scripts/parse-book1.mjs` |
| 类型 | `Record<number, BuiltinLessonContent>` |

### 数据结构

```typescript
{
  vocabulary: VocabularyItem[]   // 词汇（reading, word, meaning, kanji?）
  grammar:    GrammarItem[]      // 语法（id, name, meaning, connection, example）
  examples:   ExampleItem[]      // 例句（japanese, reading, translation, grammar?）
  patterns:   PatternItem[]      // 文型（id, pattern, sampleJapanese, ...）
  text:       TextItem[]         // 课文行（japanese, translation）
  listening:  ListeningItem[]    // 听力题
}
```

### 各模块数量统计（全 25 课）

| 模块 | 总数 |
|------|------|
| 词汇 | 930 条 |
| 例句 | 159 条 |
| 句型 | 74 条 |
| 课文行 | 130 行 |
| 听力题 | 72 题 |

### 重新生成

```bash
node scripts/parse-book1.mjs
```

---

## 四、音频资源

### 4.1 词汇音频（内容命名体系）

| 属性 | 值 |
|------|----|
| 存储路径 | `books/audio/lesson_XX/vocab_{读音}.mp3` |
| 总数 | 930 个 |
| 大小 | ~27MB |
| 声音 | `ja-JP-KeitaNeural`（男声，-10% 语速） |
| 命名规则 | 基于词汇**读音文本**，与在课中的顺序无关 |
| 前端访问 | `/api/audio/books/lesson_01/vocab_わたし.mp3` |
| 服务方式 | Next.js API Route (`src/app/api/audio/books/[...path]/route.ts`) |
| 索引文件 | `books/audio/manifest.json` |

**命名示例：**

```
わたし          → vocab_わたし.mp3
〜じん          → vocab_じん.mp3          （去掉〜）
やくに たちます  → vocab_やくに_たちます.mp3  （空格→下划线）
```

**生成/维护：**

```bash
source venv313/bin/activate

# 优先复用旧文件，缺失的自动 TTS 生成
python scripts/migrate_vocab_audio.py

# 强制全量重生成
python scripts/generate_books_audio.py --overwrite

# 只处理某课
python scripts/migrate_vocab_audio.py --lesson 3
```

---

### 4.2 例句/句型音频（内容命名体系）

| 属性 | 值 |
|------|----|
| 存储路径 | `books/audio/lesson_XX/example_{hash8}.mp3` |
|          | `books/audio/lesson_XX/pattern_{hash8}.mp3` |
| 总数 | 例句 159 个 + 句型 74 个 = 233 个 |
| 声音 | `ja-JP-KeitaNeural`（男声，-10% 语速） |
| 命名规则 | 基于日语文本的 **SHA-256 前 8 位** hash |
| 前端访问 | `/api/audio/books/lesson_01/example_a3f2b8c1.mp3` |
| 服务方式 | 同词汇，使用同一 API Route |
| 索引文件 | `books/audio/examples_manifest.json` |

**Hash 计算（Python / JS 一致）：**

```python
# Python（scripts/migrate_examples_audio.py）
hashlib.sha256(text.encode('utf-8')).hexdigest()[:8]
```

```typescript
// TypeScript（src/services/audio.ts）
const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,"0")).join("").slice(0,8)
```

**生成/维护：**

```bash
python scripts/migrate_examples_audio.py            # 全量生成
python scripts/migrate_examples_audio.py --overwrite # 强制重生成
python scripts/migrate_examples_audio.py --lesson 5  # 只处理某课
```

---

### 4.3 课文音频（内容命名体系）

| 属性 | 值 |
|------|----|
| 存储路径 | `books/audio/lesson_XX/text_{hash8}.mp3` |
| 总数 | ~271 行（25 课合计） |
| 声音 | 按说话人性别：女声 NanamiNeural / 男声 KeitaNeural |
| 命名规则 | 基于 `line.japanese` 全文的 **SHA-256 前 8 位** hash |
| 前端访问 | `/api/audio/books/lesson_01/text_a3f2b8c1.mp3` |
| 服务方式 | 同词汇，使用同一 API Route |
| 索引文件 | `books/audio/text_manifest.json` |

**Hash 计算（与词汇/例句一致）：**

```python
# Python（scripts/migrate_text_audio.py）
hashlib.sha256(line_japanese.encode('utf-8')).hexdigest()[:8]
```

```typescript
// TypeScript（src/services/audio.ts — speakText / speakTextAll）
const hash = await sha256Hash(japanese);   // 基于完整 line.japanese
```

**假名注音处理（朗读时去除）：**

```
"ミラー：初（はじ）めまして。" → 朗读 "初めまして。"  (去掉説話人前缀 + 去掉注音)
```

**说话人性别规则：**

| 判断规则 | 声音 |
|----------|------|
| カリナ、ワン、佐藤、マリア、テレーザ、アンナ 等 | 女声 NanamiNeural |
| ミラー、グプタ、山田、サントス、木村 等 | 男声 KeitaNeural |
| 姓名末尾含 子/美/恵/江/代/香/奈/理/花/葉 | 女声 |
| 其他/未知 | 男声（默认） |

**生成/维护：**

```bash
python scripts/migrate_text_audio.py                # 全量生成（复用旧文件）
python scripts/migrate_text_audio.py --overwrite    # 强制重生成
python scripts/migrate_text_audio.py --lesson 3     # 只处理某课
```

---

### 4.4 听力音频（索引命名体系）

| 属性 | 值 |
|------|----|
| 存储路径 | `public/audio/lessons/lesson_XX/listening_NNN.mp3` |
| 总数 | ~72 题 |
| 声音 | KeitaNeural（男声） |
| 命名规则 | 按听力题在课中的顺序索引（`_000`, `_001`…） |
| 前端访问 | `/audio/lessons/lesson_01/listening_000.mp3`（Next.js 静态） |
| 索引文件 | `public/audio/lessons/index.json` |

**生成/维护：**

```bash
python scripts/generate_edge_tts.py --overwrite       # 全量重生成
python scripts/generate_edge_tts.py --lesson 1 --overwrite  # 只处理某课
```

---

## 五、前端音频服务（`src/services/audio.ts`）

| 函数 | 用途 | URL 模式 |
|------|------|---------|
| `speakVocab(text, lessonId, reading)` | 播放词汇 | `/api/audio/books/lesson_XX/vocab_{reading}.mp3` |
| `speakExample(text, lessonId, type)` | 播放例句/句型 | `/api/audio/books/lesson_XX/{type}_{hash8}.mp3` |
| `speakText(japanese, lessonId)` | 播放课文单行 | `/api/audio/books/lesson_XX/text_{hash8}.mp3` |
| `speakTextAll(lines, lessonId, onProgress)` | 顺序朗读全文，带高亮回调 | 同上 |
| `speak(text, lessonId, type, index)` | 播放听力（索引命名） | `/audio/lessons/lesson_XX/listening_{NNN}.mp3` |
| `speakAll(items)` | 顺序播放（旧接口，保留兼容） | 同上 |
| `playVictory()` | 全部掌握音效 | Web Audio API 合成（无文件） |

**三级降级策略：** 预生成 MP3 → Web Speech API → 静默

---

## 六、音频验证工具（`scripts/test_audio.py`）

```bash
source venv313/bin/activate

python scripts/test_audio.py              # 全量检查
python scripts/test_audio.py --lesson 2  # 只检查某课
python scripts/test_audio.py --verbose   # 显示每个文件状态
python scripts/test_audio.py --missing   # 仅列出缺失文件
python scripts/test_audio.py --http      # 同时测试 HTTP API（需先 npm run dev）
```

---

## 七、资源维护完整流程

### 场景 A：教材内容更新（修改 book1.md）

```bash
source venv313/bin/activate
node scripts/parse-book1.mjs                          # 重新解析内容
python scripts/migrate_vocab_audio.py                 # 词汇音频（复用+补充）
python scripts/migrate_examples_audio.py --overwrite  # 例句/句型重生成
python scripts/generate_edge_tts.py --overwrite       # 课文/听力重生成
python scripts/test_audio.py                          # 验证覆盖率
```

### 场景 B：只新增几个单词

```bash
node scripts/parse-book1.mjs
python scripts/migrate_vocab_audio.py --lesson N
python scripts/test_audio.py --lesson N
```

### 场景 C：音频文件损坏/缺失

```bash
python scripts/test_audio.py --missing
find books/audio -name "*.mp3" -size -1024c -delete
python scripts/migrate_vocab_audio.py
python scripts/migrate_examples_audio.py --overwrite
```

### 场景 D：全新环境初始化

```bash
npm install
source venv313/bin/activate && pip install edge-tts

python scripts/migrate_vocab_audio.py
python scripts/migrate_examples_audio.py
python scripts/generate_edge_tts.py

python scripts/test_audio.py
npm run dev
```

---

## 八、脚本索引

| 脚本 | 语言 | 用途 |
|------|------|------|
| `scripts/parse-book1.mjs` | Node.js ESM | 解析 book1.md → 生成 builtin-content.ts |
| `scripts/migrate_vocab_audio.py` | Python | 词汇音频迁移/生成（内容命名，优先复用旧文件） |
| `scripts/generate_books_audio.py` | Python | 词汇音频全量重生成（不复用旧文件） |
| `scripts/migrate_examples_audio.py` | Python | 例句/句型音频生成（SHA-256 命名） |
| `scripts/migrate_text_audio.py` | Python | 课文音频迁移/生成（内容命名，SHA-256 hash） |
| `scripts/generate_edge_tts.py` | Python | 听力音频生成（索引命名，支持 --overwrite） |
| `scripts/test_audio.py` | Python | 音频文件自动化测试工具 |

---

## 九、不纳入 Git 的资源

```gitignore
/books/audio/   # 词汇/例句/句型音频（~27MB）
/public/audio/  # 课文/听力音频（~9.4MB）
```
