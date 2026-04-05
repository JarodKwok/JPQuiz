"use client";

import { useMemo } from "react";
import { getTagLabel, VOCABULARY_TAGS } from "@/data/vocabulary-tags";

interface TagCount {
  tag: string;
  count: number;
}

interface TagFilterChipsProps {
  /** All words (with tags) to derive available tags */
  words: { tags?: string[] }[];
  /** Currently active tag filter (null = show all) */
  activeTag: string | null;
  /** Called when user selects/deselects a tag */
  onTagChange: (tag: string | null) => void;
}

export default function TagFilterChips({
  words,
  activeTag,
  onTagChange,
}: TagFilterChipsProps) {
  const availableTags: TagCount[] = useMemo(() => {
    const tagCounts = new Map<string, number>();
    for (const word of words) {
      for (const tag of word.tags ?? []) {
        tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
      }
    }

    // Sort by the canonical order defined in VOCABULARY_TAGS
    const orderMap = new Map(VOCABULARY_TAGS.map((t, i) => [t.key, i]));
    return Array.from(tagCounts.entries())
      .sort((a, b) => (orderMap.get(a[0]) ?? 99) - (orderMap.get(b[0]) ?? 99))
      .map(([tag, count]) => ({ tag, count }));
  }, [words]);

  if (availableTags.length === 0) return null;

  return (
    <div className="flex items-center gap-2 mt-2 flex-wrap">
      {/* "全部" chip */}
      <button
        onClick={() => onTagChange(null)}
        className={`text-xs px-2.5 py-1 rounded-full border transition-colors flex items-center gap-1 ${
          activeTag === null
            ? "border-primary text-primary bg-primary/10"
            : "border-border text-text-muted hover:border-border/80 hover:text-text-secondary"
        }`}
      >
        全部
      </button>

      {availableTags.map(({ tag, count }) => (
        <button
          key={tag}
          onClick={() => onTagChange(activeTag === tag ? null : tag)}
          className={`text-xs px-2.5 py-1 rounded-full border transition-colors flex items-center gap-1 ${
            activeTag === tag
              ? "border-accent text-accent bg-accent/10"
              : "border-border text-text-muted hover:border-border/80 hover:text-text-secondary"
          }`}
        >
          {getTagLabel(tag)}
          <span
            className={`text-[10px] px-1 py-0.5 rounded-full ${
              activeTag === tag ? "bg-current/10" : "bg-border/50"
            }`}
          >
            {count}
          </span>
        </button>
      ))}
    </div>
  );
}
