/**
 * 词汇分组标签体系
 * 两个维度：词性（part of speech）+ 语义主题（semantic topic）
 */

export interface TagDefinition {
  key: string;
  label: string; // 中文显示名
  category: "pos" | "topic"; // pos=词性, topic=语义主题
}

/** 标签定义，按显示顺序排列 */
export const VOCABULARY_TAGS: TagDefinition[] = [
  // 词性标签
  { key: "noun", label: "名词", category: "pos" },
  { key: "verb", label: "动词", category: "pos" },
  { key: "i-adj", label: "い形容词", category: "pos" },
  { key: "na-adj", label: "な形容词", category: "pos" },
  { key: "adverb", label: "副词", category: "pos" },
  { key: "counter", label: "量词", category: "pos" },
  { key: "greeting", label: "寒暄语", category: "pos" },
  { key: "pronoun", label: "代词", category: "pos" },
  { key: "conjunction", label: "接续词", category: "pos" },
  { key: "expression", label: "惯用表达", category: "pos" },
  { key: "particle", label: "助词", category: "pos" },
  // 语义主题标签
  { key: "time", label: "时间", category: "topic" },
  { key: "weekday", label: "星期", category: "topic" },
  { key: "date", label: "日期", category: "topic" },
  { key: "number", label: "数字", category: "topic" },
  { key: "place", label: "场所", category: "topic" },
  { key: "country", label: "国家", category: "topic" },
  { key: "person", label: "人物", category: "topic" },
  { key: "transport", label: "交通", category: "topic" },
  { key: "food", label: "食物", category: "topic" },
  { key: "object", label: "物品", category: "topic" },
  { key: "katakana", label: "片假名词", category: "topic" },
  { key: "nature", label: "自然", category: "topic" },
  { key: "body", label: "身体", category: "topic" },
  { key: "color", label: "颜色", category: "topic" },
  { key: "family", label: "家庭", category: "topic" },
  { key: "activity", label: "活动", category: "topic" },
];

/** 标签 key -> 定义的快速查找表 */
export const TAG_MAP = new Map(VOCABULARY_TAGS.map((t) => [t.key, t]));

/** 获取标签的中文显示名，未知标签返回 key 本身 */
export function getTagLabel(key: string): string {
  return TAG_MAP.get(key)?.label ?? key;
}
