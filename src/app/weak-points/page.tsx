"use client";

import { useState, useEffect, useCallback } from "react";
import { BookOpen, Languages, Trash2, RefreshCw } from "lucide-react";
import { getWeakItems, updateMasteryById, deleteMasteryById } from "@/services/mastery";
import MasteryButtons from "@/components/lesson/MasteryButtons";
import type { MasteryStatus, MasteryLevel, Module } from "@/types";

const MODULE_LABELS: Record<Module, { label: string; icon: typeof BookOpen }> = {
  vocabulary: { label: "单词", icon: BookOpen },
  grammar: { label: "语法", icon: Languages },
  text: { label: "课文", icon: BookOpen },
  examples: { label: "例句", icon: BookOpen },
  listening: { label: "听力", icon: BookOpen },
};

export default function WeakPointsPage() {
  const [items, setItems] = useState<MasteryStatus[]>([]);
  const [loading, setLoading] = useState(true);

  const loadItems = useCallback(async () => {
    setLoading(true);
    const data = await getWeakItems();
    setItems(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void loadItems();
    });
  }, [loadItems]);

  const handleMastery = async (item: MasteryStatus, level: MasteryLevel) => {
    if (!item.id) return;
    await updateMasteryById(item.id, level);
    // If mastered, remove from list; otherwise update in place
    if (level === "mastered") {
      setItems((prev) => prev.filter((i) => i.id !== item.id));
    } else {
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, status: level } : i))
      );
    }
  };

  const handleDelete = async (id: number) => {
    await deleteMasteryById(id);
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold text-text">
            薄弱本
            <span className="text-text-muted font-normal ml-2 text-sm">
              ふくしゅう
            </span>
          </h1>
          <p className="text-xs text-text-muted mt-1">
            收录标记为「模糊」或「不会」的知识点 · {items.length} 项
          </p>
        </div>
        <button
          onClick={loadItems}
          className="p-1.5 rounded-lg border border-border text-text-secondary
                     hover:border-primary/40 hover:text-primary transition-colors"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* Empty state */}
      {!loading && items.length === 0 && (
        <div className="bg-bg-card border border-border rounded-xl p-8 text-center">
          <div className="flex justify-center gap-3 mb-4 text-text-muted">
            <BookOpen size={24} strokeWidth={1.5} />
            <Languages size={24} strokeWidth={1.5} />
          </div>
          <p className="text-sm text-text-secondary">暂无薄弱知识点</p>
          <p className="text-xs text-text-muted mt-1">
            在学习过程中标记「模糊」或「不会」的内容会自动收录到这里
          </p>
        </div>
      )}

      {/* Item list */}
      {!loading && items.length > 0 && (
        <div className="space-y-3">
          {items.map((item) => {
            const mod = MODULE_LABELS[item.module] || {
              label: item.module,
              icon: BookOpen,
            };

            return (
              <div
                key={item.id}
                className="bg-bg-card border border-border rounded-xl p-4
                           hover:border-primary/20 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`text-[11px] px-2 py-0.5 rounded-full
                          ${item.status === "weak"
                            ? "bg-weak/15 text-weak"
                            : "bg-fuzzy/15 text-fuzzy"
                          }`}
                      >
                        {item.status === "weak" ? "不会" : "模糊"}
                      </span>
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                        {mod.label}
                      </span>
                      <span className="text-[11px] text-text-muted">
                        第 {item.lessonId} 課
                      </span>
                    </div>
                    <p className="text-sm font-medium text-text">
                      {item.itemKey}
                    </p>
                    <p className="text-[11px] text-text-muted mt-1">
                      复习 {item.reviewCount} 次 · 最后复习{" "}
                      {item.lastReviewedAt
                        ? new Date(item.lastReviewedAt).toLocaleDateString("zh-CN")
                        : "未知"}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <MasteryButtons
                      current={item.status}
                      onChange={(level) => handleMastery(item, level)}
                      size="sm"
                    />
                    <button
                      onClick={() => item.id && handleDelete(item.id)}
                      className="p-1.5 rounded-lg text-text-muted hover:text-weak
                                 hover:bg-weak/10 transition-colors"
                      title="删除记录"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
