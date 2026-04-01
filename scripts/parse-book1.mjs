/**
 * parse-book1.mjs
 * 解析 books/book1.md，生成新的 src/data/builtin-content.ts
 * 用法：node scripts/parse-book1.mjs
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// ============================================================
// 文字清理工具
// ============================================================

/** 清理日语文本：去除振假名标注 */
function cleanJp(text) {
  if (!text) return '';
  return text
    // 格式1: <small>reading</small>（kanji） → kanji
    .replace(/<small>[^<]+<\/small>（([^）]+)）/g, '$1')
    // 格式2: kanji<small>（reading）</small> → kanji
    .replace(/<small>（[^）]+）<\/small>/g, '')
    // 格式3: 其他 <small>...</small>
    .replace(/<small>[^<]*<\/small>/g, '')
    // 去掉 [可选] 括号，保留内容
    .replace(/\[([^\]]+)\]/g, '$1')
    // 规范化空格
    .replace(/\s+/g, ' ')
    .trim();
}

/** 清理中文文本 */
function cleanCn(text) {
  if (!text) return '';
  return text
    .replace(/<small>[^<]*<\/small>/g, '')
    .replace(/\[([^\]]+)\]/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

/** 转义用于TypeScript字符串的特殊字符 */
function esc(str) {
  if (!str) return '';
  return str
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '');
}

/** 判断是否包含日语假名 */
function hasKana(text) {
  return /[\u3040-\u309f\u30a0-\u30ff]/.test(text);
}

/** 判断是否是主要中文（包含汉字但几乎无假名） */
function isMostlyChinese(text) {
  return /[\u4e00-\u9fff]/.test(text) && !hasKana(text);
}

// ============================================================
// 词汇解析
// ============================================================

function parseVocab(lessonText) {
  const items = [];
  const lines = lessonText.split('\n');
  let tableType = 0; // 0=none, 4=vocab, 2=greeting

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line.startsWith('|')) {
      if (tableType > 0 && !line.startsWith('|')) tableType = 0;
      continue;
    }

    // 跳过分割行
    if (line.includes('---')) continue;

    const cols = line.split('|').map(c => c.trim()).filter(Boolean);

    // 检测表头
    if (cols[0] === '读音' || cols[0] === '単语' || cols[0] === '単词') {
      tableType = 4;
      continue;
    }
    if (cols[0] === '表达') {
      tableType = 2;
      continue;
    }
    // 跳过其他表头 (如 こ系列 等)
    if (!tableType) continue;

    if (tableType === 4 && cols.length >= 4) {
      let [reading, kanji, , meaning] = cols;

      // 清理reading列：去掉括号内的假名提示或kanji提示
      // 格式 "いま（今）" → "いま"
      // 格式 "おきます（←おきる）" → "おきます"
      reading = reading.replace(/（[^）]*）/g, '').trim();
      if (!reading) continue;

      // 清理kanji列
      kanji = kanji
        .replace(/<small>[^<]*<\/small>/g, '')
        .replace(/（[a-zA-Z\s\-\.]+）/g, '') // 去掉英文括号
        .trim();

      // 如果kanji只剩空括号或等于reading，清空
      if (kanji === reading || kanji === '（）' || kanji === '') kanji = '';

      meaning = cleanCn(meaning);
      if (!reading || !meaning) continue;

      items.push({ reading, kanji, meaning });

    } else if (tableType === 2 && cols.length >= 2) {
      // 寒暄表达
      let [expr, meaning] = cols;
      expr = cleanJp(expr).trim();
      meaning = '【寒暄】' + cleanCn(meaning);
      if (!expr || expr === '表达') continue;
      items.push({ reading: expr, kanji: '', meaning });
    }
  }

  return items;
}

// ============================================================
// 语法解析
// ============================================================

const CIRCLED = '①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳';

function hasCircled(text) {
  return [...CIRCLED].some(c => text.includes(c));
}

function parseGrammar(section, lessonNum) {
  const items = [];
  const lines = section.split('\n');

  // 找到所有语法条目的起始行
  const blocks = [];
  let currentBlock = null;
  let grammarNum = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 格式1: #### 语法N：name 或 #### 語法N：name
    const m1 = line.match(/^####\s*[语語]法(\d+)[：:]\s*(.+)/);
    // 格式2: **N. name** (独立行)
    const m2 = line.match(/^\*\*(\d+)\.\s*(.+?)\*\*\s*$/);

    if (m1 || m2) {
      if (currentBlock) blocks.push(currentBlock);
      grammarNum++;
      const name = m1 ? m1[2].trim() : m2[2].trim();
      currentBlock = { num: grammarNum, name, bodyLines: [] };
    } else if (currentBlock) {
      currentBlock.bodyLines.push(line);
    }
  }
  if (currentBlock) blocks.push(currentBlock);

  for (const block of blocks) {
    const { num, name, bodyLines } = block;
    const bodyText = bodyLines.join('\n');

    // 提取含义：收集第一段实质性说明文字
    // 跳过空行和 **N) 子标题**，遇到 --- 或带圈数字列表则停止
    const meaningLines = [];
    let foundContent = false;
    for (const bl of bodyLines) {
      const t = bl.trim();
      if (!t) {
        // 空行：如果已收集内容则停止，否则跳过
        if (foundContent) break;
        continue;
      }
      if (t === '---') break;
      // 带圈数字的例句行 → 停止
      if (hasCircled(t)) break;
      // 以 "- ①" 格式开头的行 → 停止
      if (t.startsWith('- ') && t.length > 2 && hasCircled(t.slice(2))) break;
      // 以 "- **bold**" 开头的说明性要点行 → 停止收集（这些是细分说明）
      if (t.startsWith('- **') || t.startsWith('- ') && foundContent) break;
      // 跳过子标题 **N) xxx** 或 **N. xxx**
      if (t.startsWith('**') && (t.includes(')') || t.includes('.'))) {
        continue; // 跳过子标题但不停止
      }
      // 跳过表格行
      if (t.startsWith('|')) continue;
      // 跳过 [注] 行
      if (t.startsWith('>')) continue;
      // 跳过纯数字列表（1. 2. 用于举例）
      if (/^\d+\.\s/.test(t)) continue;
      // 正常说明文字
      meaningLines.push(t);
      foundContent = true;
    }
    const meaning = cleanCn(meaningLines.join('').slice(0, 150)) || cleanCn(name);

    // 提取第一个带圈数字的例句 + 翻译
    let example = '';
    let exampleTranslation = '';

    for (let i = 0; i < bodyLines.length && !example; i++) {
      const t = bodyLines[i].trim();
      if (!hasCircled(t)) continue;

      // 提取例句（去掉前缀的 - 、缩进和圈数字）
      const jpRaw = t
        .replace(/^-\s*/, '')
        .replace(/^[①-⑳]\s*/, '')
        .trim();
      if (!jpRaw) continue;
      example = cleanJp(jpRaw);

      // 找翻译行（下一个非空行，以 "- " 开头或为缩进的中文行）
      for (let j = i + 1; j < bodyLines.length; j++) {
        const next = bodyLines[j].trim();
        if (!next) continue;
        if (next.startsWith('- ')) {
          const cnRaw = next.replace(/^-\s*/, '');
          // 确认是中文（非日语）
          if (isMostlyChinese(cnRaw) || /[。！？、，]/.test(cnRaw)) {
            exampleTranslation = cleanCn(cnRaw);
          }
          break;
        }
        // 缩进的续行（如 "　　……"），可能是日语续行
        if (next.startsWith('　')) {
          if (hasKana(next)) {
            // 日语续行，追加到例句
            example += next.trim();
          }
          continue;
        }
        break;
      }
    }

    // 提取注释作为tip
    let tip;
    const noteMatch = bodyText.match(/>\s*\[注\]\s*(.+)/);
    if (noteMatch) {
      tip = cleanCn(noteMatch[1].trim().slice(0, 100));
    }

    // 如果没有找到例句，用语法名称作为例句
    if (!example) example = cleanJp(name);
    if (!exampleTranslation) exampleTranslation = '';

    items.push({
      id: `${lessonNum}-${num}`,
      name: cleanJp(name),
      meaning,
      connection: cleanJp(name),
      example,
      exampleTranslation,
      tip,
    });
  }

  return items;
}

// ============================================================
// 例句解析（文型 + 例文）
// ============================================================

function parseExamples(section, lessonNum) {
  const patterns = [];
  const examples = [];

  // ---- 文型 ----
  // **文型** 部分：编号列表 "1. 日语（中文）"
  const bunoMatch = section.match(/\*\*文型\*\*\n([\s\S]*?)(?=\n\*\*例文|\n---|\n### |$)/);
  if (bunoMatch) {
    const bunoLines = bunoMatch[1].split('\n').filter(l => /^\s*\d+\./.test(l));
    bunoLines.forEach((rawLine, idx) => {
      const line = rawLine.trim().replace(/^\d+\.\s*/, '');
      // 匹配 "日语文本（中文翻译）"
      const m = line.match(/^([\s\S]+?)（([^）]+)）\s*$/);
      if (m) {
        const pattern = cleanJp(m[1].trim());
        const meaning = cleanCn(m[2]);
        patterns.push({
          id: `${lessonNum}-P${idx + 1}`,
          pattern,
          meaning,
          structure: pattern,
          sampleJapanese: pattern,
          sampleReading: pattern,
          sampleTranslation: meaning,
        });
      } else {
        const text = cleanJp(line);
        if (text) {
          patterns.push({
            id: `${lessonNum}-P${idx + 1}`,
            pattern: text,
            meaning: '',
            structure: text,
            sampleJapanese: text,
            sampleReading: text,
            sampleTranslation: '',
          });
        }
      }
    });
  }

  // ---- 例文 ----
  // 找到每个 **例文N** 块
  const exRegex = /\*\*例文\d+\*\*\n([\s\S]*?)(?=\n\*\*例文\d+|\n---|\n### |\n## |$)/g;
  let exMatch;
  while ((exMatch = exRegex.exec(section)) !== null) {
    const block = exMatch[1];
    const blockLines = block.split('\n');

    const jpParts = [];
    const cnParts = [];

    for (const rawBl of blockLines) {
      const bl = rawBl.trim();
      if (!bl) continue;

      // 去掉行首的 "- " 或 "……"
      const content = bl.replace(/^-\s*/, '');
      if (!content) continue;

      if (hasKana(content)) {
        // 包含假名 → 日语
        jpParts.push(cleanJp(content));
      } else if (isMostlyChinese(content)) {
        // 仅中文 → 翻译
        cnParts.push(cleanCn(content));
      }
      // 其他行（英文等）忽略
    }

    if (jpParts.length > 0) {
      examples.push({
        japanese: jpParts.join('　'),
        reading: jpParts.join('　'),
        translation: cnParts.join('　'),
      });
    }
  }

  return { patterns, examples };
}

// ============================================================
// 课文解析
// ============================================================

function parseText(section) {
  // 找标题 **title**
  const titleMatch = section.match(/\*\*([^*\n（]+)/);
  const title = titleMatch ? cleanJp(titleMatch[1].trim()) : '';

  // 找代码块（日语 + 中文各一个），支持 ```text 和 ``` 格式
  const codeBlocks = [...section.matchAll(/```(?:text)?\n([\s\S]*?)```/g)];
  if (codeBlocks.length < 2) {
    return { title, lines: [] };
  }

  const jpRaw = codeBlocks[0][1].split('\n');
  const cnRaw = codeBlocks[1][1].split('\n');

  // 判断是否为舞台指示行（如 ･･････）
  const isStage = (l) => l.includes('･･') || /^[（(]/.test(l.trim());

  // 过滤空行和舞台指示
  const jpLines = jpRaw.map(l => l.trim()).filter(l => l && !isStage(l));
  const cnLines = cnRaw.map(l => l.trim()).filter(l => l && !isStage(l));

  const lines = [];
  let jpIdx = 0, cnIdx = 0;

  while (jpIdx < jpLines.length && cnIdx < cnLines.length) {
    const jp = jpLines[jpIdx];
    const cn = cnLines[cnIdx];

    // 续行（以全角空格缩进）
    const isJpCont = jp.startsWith('　　');
    const isCnCont = cn.startsWith('　　');

    if (!isJpCont && !isCnCont) {
      // 两行都是新行
      lines.push({
        japanese: cleanJp(jp),
        translation: cleanCn(cn),
      });
      jpIdx++;
      cnIdx++;
    } else if (isJpCont && isCnCont) {
      // 两行都是续行，追加到上一行
      if (lines.length > 0) {
        lines[lines.length - 1].japanese += '　' + cleanJp(jp.replace(/^　+/, ''));
        lines[lines.length - 1].translation += '　' + cleanCn(cn.replace(/^　+/, ''));
      }
      jpIdx++;
      cnIdx++;
    } else {
      // 不匹配情况：直接添加
      lines.push({
        japanese: cleanJp(jp.replace(/^　+/, '')),
        translation: cleanCn(cn.replace(/^　+/, '')),
      });
      jpIdx++;
      cnIdx++;
    }
  }

  return { title, lines };
}

// ============================================================
// 从现有 builtin-content.ts 提取listening数据
// ============================================================

function extractListeningFromBuiltin(builtinContent) {
  const listeningMap = {};

  // 找到每个课的 listening: [...] 块
  // 用状态机提取括号内的内容
  for (let lessonNum = 1; lessonNum <= 25; lessonNum++) {
    // 找到该课的起始位置（N: lesson({）
    const lessonRegex = new RegExp(`\\b${lessonNum}:\\s*lesson\\s*\\(\\s*\\{`);
    const lessonMatch = builtinContent.search(lessonRegex);
    if (lessonMatch === -1) continue;

    // 在该课的范围内找 listening: [
    const lessonSlice = builtinContent.slice(lessonMatch);
    const listenMatch = lessonSlice.search(/\blistening\s*:/);
    if (listenMatch === -1) continue;

    // 从 [ 开始提取到配对的 ]
    const startBracket = lessonSlice.indexOf('[', listenMatch);
    if (startBracket === -1) continue;

    let depth = 0;
    let i = startBracket;
    for (; i < lessonSlice.length; i++) {
      if (lessonSlice[i] === '[') depth++;
      else if (lessonSlice[i] === ']') {
        depth--;
        if (depth === 0) { i++; break; }
      }
    }

    const listenText = lessonSlice.slice(startBracket, i);
    listeningMap[lessonNum] = listenText;
  }

  return listeningMap;
}

// ============================================================
// 解析整本书
// ============================================================

function parseBook(content) {
  const lessons = {};

  // 按 "## 第N课" 分割（文件可能以 ## 开头，预先加换行）
  const lessonSections = ('\n' + content).split(/\n## 第(\d+)课\n/);
  // lessonSections[0] = 前言（忽略）
  // lessonSections[1] = "1", lessonSections[2] = lesson 1 content
  // lessonSections[3] = "2", lessonSections[4] = lesson 2 content...

  for (let i = 1; i < lessonSections.length; i += 2) {
    const lessonNum = parseInt(lessonSections[i]);
    const lessonText = lessonSections[i + 1] || '';

    if (!lessonNum || lessonNum < 1 || lessonNum > 25) continue;

    // 分割各section
    // 用 "### N. " 来分割
    const sectionMap = {};
    const sectionParts = lessonText.split(/\n###\s+\d+\.\s+/);

    // 找第一个 ### 前的内容（忽略）
    const sectionHeaders = [...lessonText.matchAll(/\n###\s+\d+\.\s+(\S+)/g)];

    sectionHeaders.forEach((match, idx) => {
      const sectionName = match[1]; // 词汇/语法/例句/例文/课文
      const startOffset = match.index;
      const endOffset = idx + 1 < sectionHeaders.length
        ? sectionHeaders[idx + 1].index
        : lessonText.length;
      sectionMap[sectionName] = lessonText.slice(startOffset, endOffset);
    });

    // 词汇
    const vocabSection = sectionMap['词汇'] || '';
    const vocabItems = parseVocab(vocabSection);

    // 语法
    const grammarSection = sectionMap['语法'] || '';
    const grammarItems = parseGrammar(grammarSection, lessonNum);

    // 例句/例文
    const exSection = sectionMap['例句'] || sectionMap['例文'] || '';
    const { patterns, examples } = parseExamples(exSection, lessonNum);

    // 课文
    const textSection = sectionMap['课文'] || '';
    const textContent = parseText(textSection);

    lessons[lessonNum] = {
      vocab: vocabItems,
      grammar: grammarItems,
      patterns,
      examples,
      text: textContent,
    };

    console.log(`课 ${lessonNum}: 词汇${vocabItems.length}, 语法${grammarItems.length}, 文型${patterns.length}, 例文${examples.length}, 课文行${textContent.lines.length}`);
  }

  return lessons;
}

// ============================================================
// 生成 TypeScript 代码
// ============================================================

function generateTS(lessons, listeningMap) {
  const lines = [];

  // 文件头
  lines.push(`import type {`);
  lines.push(`  ExampleItem,`);
  lines.push(`  ExamplesContent,`);
  lines.push(`  GrammarItem,`);
  lines.push(`  ListeningItem,`);
  lines.push(`  ModuleContentMap,`);
  lines.push(`  SentencePatternItem,`);
  lines.push(`  TextContent,`);
  lines.push(`  TextLine,`);
  lines.push(`  VocabularyItem,`);
  lines.push(`} from "@/types/content";`);
  lines.push(``);
  lines.push(`type BuiltinLessonContent = ModuleContentMap;`);
  lines.push(``);
  lines.push(`const BUILTIN_TIMESTAMP = "2025-03-26T00:00:00.000Z";`);
  lines.push(`export const BUILTIN_CONTENT_UPDATED_AT = BUILTIN_TIMESTAMP;`);
  lines.push(``);

  // helper functions
  lines.push(`const v = (`);
  lines.push(`  word: string,`);
  lines.push(`  reading: string,`);
  lines.push(`  meaning: string,`);
  lines.push(`  example?: string,`);
  lines.push(`  kanji?: string`);
  lines.push(`): VocabularyItem => ({`);
  lines.push(`  word,`);
  lines.push(`  reading,`);
  lines.push(`  meaning,`);
  lines.push(`  example,`);
  lines.push(`  kanji,`);
  lines.push(`});`);
  lines.push(``);

  lines.push(`const g = (`);
  lines.push(`  id: string,`);
  lines.push(`  name: string,`);
  lines.push(`  meaning: string,`);
  lines.push(`  connection: string,`);
  lines.push(`  example: string,`);
  lines.push(`  exampleTranslation: string,`);
  lines.push(`  tip?: string`);
  lines.push(`): GrammarItem => ({`);
  lines.push(`  id,`);
  lines.push(`  name,`);
  lines.push(`  meaning,`);
  lines.push(`  connection,`);
  lines.push(`  example,`);
  lines.push(`  exampleTranslation,`);
  lines.push(`  tip,`);
  lines.push(`});`);
  lines.push(``);

  lines.push(`const p = (`);
  lines.push(`  id: string,`);
  lines.push(`  pattern: string,`);
  lines.push(`  meaning: string,`);
  lines.push(`  structure: string,`);
  lines.push(`  sampleJapanese: string,`);
  lines.push(`  sampleReading: string,`);
  lines.push(`  sampleTranslation: string,`);
  lines.push(`  notes?: string`);
  lines.push(`): SentencePatternItem => ({`);
  lines.push(`  id,`);
  lines.push(`  pattern,`);
  lines.push(`  meaning,`);
  lines.push(`  structure,`);
  lines.push(`  sampleJapanese,`);
  lines.push(`  sampleReading,`);
  lines.push(`  sampleTranslation,`);
  lines.push(`  notes,`);
  lines.push(`});`);
  lines.push(``);

  lines.push(`const e = (`);
  lines.push(`  japanese: string,`);
  lines.push(`  reading: string,`);
  lines.push(`  translation: string,`);
  lines.push(`  grammar?: string`);
  lines.push(`): ExampleItem => ({`);
  lines.push(`  japanese,`);
  lines.push(`  reading,`);
  lines.push(`  translation,`);
  lines.push(`  grammar,`);
  lines.push(`});`);
  lines.push(``);

  lines.push(`const line = (`);
  lines.push(`  japanese: string,`);
  lines.push(`  translation: string,`);
  lines.push(`  notes?: string`);
  lines.push(`): TextLine => ({`);
  lines.push(`  japanese,`);
  lines.push(`  translation,`);
  lines.push(`  notes,`);
  lines.push(`});`);
  lines.push(``);

  lines.push(`const t = (title: string, lines: TextLine[]): TextContent => ({`);
  lines.push(`  title,`);
  lines.push(`  lines,`);
  lines.push(`});`);
  lines.push(``);

  lines.push(`const q = (`);
  lines.push(`  text: string,`);
  lines.push(`  options: string[],`);
  lines.push(`  answer: number`);
  lines.push(`): ListeningItem => ({`);
  lines.push(`  text,`);
  lines.push(`  options,`);
  lines.push(`  answer,`);
  lines.push(`});`);
  lines.push(``);

  lines.push(`function lesson(content: {`);
  lines.push(`  vocabulary: VocabularyItem[];`);
  lines.push(`  grammar: GrammarItem[];`);
  lines.push(`  patterns: SentencePatternItem[];`);
  lines.push(`  examples: ExampleItem[];`);
  lines.push(`  text: TextContent;`);
  lines.push(`  listening: ListeningItem[];`);
  lines.push(`}): BuiltinLessonContent {`);
  lines.push(`  const examples: ExamplesContent = {`);
  lines.push(`    patterns: content.patterns,`);
  lines.push(`    examples: content.examples,`);
  lines.push(`  };`);
  lines.push(`  return {`);
  lines.push(`    vocabulary: content.vocabulary,`);
  lines.push(`    grammar: content.grammar,`);
  lines.push(`    examples,`);
  lines.push(`    text: content.text,`);
  lines.push(`    listening: content.listening,`);
  lines.push(`  };`);
  lines.push(`}`);
  lines.push(``);

  lines.push(`// =============================================================================`);
  lines.push(`// 大家的日语初级I - 完整课程内容`);
  lines.push(`// 基于《大家的日语》初级I（第二版）教材 books/book1.md`);
  lines.push(`// =============================================================================`);
  lines.push(``);
  lines.push(`export const BUILTIN_LESSON_CONTENT: Record<number, BuiltinLessonContent> = {`);

  for (let lessonNum = 1; lessonNum <= 25; lessonNum++) {
    const lesson = lessons[lessonNum];
    if (!lesson) {
      console.warn(`警告：第${lessonNum}课数据缺失，跳过`);
      continue;
    }

    const { vocab, grammar, patterns, examples, text } = lesson;
    const listening = listeningMap[lessonNum] || '[]';

    lines.push(`  // ============================================================================`);
    lines.push(`  // 第${lessonNum}课`);
    lines.push(`  // ============================================================================`);
    lines.push(`  ${lessonNum}: lesson({`);

    // vocabulary
    lines.push(`    vocabulary: [`);
    for (const item of vocab) {
      const word = esc(item.reading);
      const reading = esc(item.reading);
      const meaning = esc(item.meaning);
      const kanji = item.kanji ? `, "${esc(item.kanji)}"` : '';
      lines.push(`      v("${word}", "${reading}", "${meaning}"${kanji ? `, undefined${kanji}` : ''}),`);
    }
    lines.push(`    ],`);

    // grammar
    lines.push(`    grammar: [`);
    for (const item of grammar) {
      const id = esc(item.id);
      const name = esc(item.name);
      const meaning = esc(item.meaning);
      const connection = esc(item.connection);
      const example = esc(item.example);
      const exTrans = esc(item.exampleTranslation);
      const tip = item.tip ? `, "${esc(item.tip)}"` : '';
      lines.push(`      g("${id}", "${name}", "${meaning}", "${connection}", "${example}", "${exTrans}"${tip}),`);
    }
    lines.push(`    ],`);

    // patterns
    lines.push(`    patterns: [`);
    for (const item of patterns) {
      const id = esc(item.id);
      const pattern = esc(item.pattern);
      const meaning = esc(item.meaning);
      const structure = esc(item.structure);
      const sampleJp = esc(item.sampleJapanese);
      const sampleR = esc(item.sampleReading);
      const sampleT = esc(item.sampleTranslation);
      lines.push(`      p("${id}", "${pattern}", "${meaning}", "${structure}", "${sampleJp}", "${sampleR}", "${sampleT}"),`);
    }
    lines.push(`    ],`);

    // examples
    lines.push(`    examples: [`);
    for (const item of examples) {
      const jp = esc(item.japanese);
      const r = esc(item.reading);
      const t = esc(item.translation);
      lines.push(`      e("${jp}", "${r}", "${t}"),`);
    }
    lines.push(`    ],`);

    // text
    lines.push(`    text: t("${esc(text.title)}", [`);
    for (const l of text.lines) {
      const jp = esc(l.japanese);
      const cn = esc(l.translation);
      lines.push(`      line("${jp}", "${cn}"),`);
    }
    lines.push(`    ]),`);

    // listening (原样保留)
    lines.push(`    listening: ${listening},`);

    lines.push(`  }),`);
    lines.push(``);
  }

  lines.push(`};`);
  lines.push(``);

  // 导出函数（保持与原始文件相同的泛型签名）
  lines.push(`export function getLessonContent(lessonId: number): BuiltinLessonContent | null {`);
  lines.push(`  return BUILTIN_LESSON_CONTENT[lessonId] ?? null;`);
  lines.push(`}`);
  lines.push(``);

  lines.push(`export function getBuiltinModuleContent<M extends keyof ModuleContentMap>(`);
  lines.push(`  lessonId: number,`);
  lines.push(`  module: M`);
  lines.push(`): ModuleContentMap[M] | null {`);
  lines.push(`  const lesson = getLessonContent(lessonId);`);
  lines.push(`  if (!lesson) return null;`);
  lines.push(`  return lesson[module] ?? null;`);
  lines.push(`}`);
  lines.push(``);

  lines.push(`export function hasLessonContent(lessonId: number): boolean {`);
  lines.push(`  return lessonId in BUILTIN_LESSON_CONTENT;`);
  lines.push(`}`);
  lines.push(``);


  return lines.join('\n');
}

// ============================================================
// 主程序
// ============================================================

console.log('读取 book1.md...');
const bookContent = readFileSync(join(ROOT, 'books/book1.md'), 'utf-8');

// 优先从 /tmp/original-builtin.ts 读取（保存了原始listening数据），否则从当前文件读取
console.log('读取原始 builtin-content.ts（提取listening数据）...');
let existingBuiltinPath = '/tmp/original-builtin.ts';
try {
  readFileSync(existingBuiltinPath, 'utf-8');
  console.log('使用 /tmp/original-builtin.ts');
} catch {
  existingBuiltinPath = join(ROOT, 'src/data/builtin-content.ts');
  console.log('使用当前 builtin-content.ts');
}
const existingBuiltin = readFileSync(existingBuiltinPath, 'utf-8');

console.log('解析书籍内容...');
const lessons = parseBook(bookContent);

console.log('提取existing listening数据...');
const listeningMap = extractListeningFromBuiltin(existingBuiltin);
console.log(`提取到 ${Object.keys(listeningMap).length} 课的listening数据`);

console.log('生成 TypeScript 代码...');
const tsCode = generateTS(lessons, listeningMap);

const outputPath = join(ROOT, 'src/data/builtin-content.ts');
writeFileSync(outputPath, tsCode, 'utf-8');
console.log(`✅ 已写入 ${outputPath}`);
console.log(`文件大小: ${(tsCode.length / 1024).toFixed(1)} KB`);
