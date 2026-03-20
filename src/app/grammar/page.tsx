"use client";

import { useState, useEffect } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useLessonStore } from "@/stores/lessonStore";
import MasteryButtons from "@/components/lesson/MasteryButtons";
import { saveMastery, getMasteryMap } from "@/services/mastery";
import type { MasteryLevel } from "@/types";
import { cn } from "@/lib/utils";

interface GrammarPoint {
  id: string;
  name: string;
  meaning: string;
  connection: string;
  example: string;
  exampleTranslation: string;
  tip?: string;
  mastery?: MasteryLevel;
}

const MOCK_GRAMMAR: Record<number, GrammarPoint[]> = {
  1: [
    {
      id: "1-1",
      name: "〜は 〜です",
      meaning: "～是～（肯定句）",
      connection: "名词 + は + 名词 + です",
      example: "わたしは マイク・ミラーです。",
      exampleTranslation: "我是迈克·米勒。",
      tip: "「は」作助词时读作「wa」，不读「ha」。",
    },
    {
      id: "1-2",
      name: "〜は 〜じゃ ありません",
      meaning: "～不是～（否定句）",
      connection: "名词 + は + 名词 + じゃ ありません",
      example: "サントスさんは 学生じゃ ありません。",
      exampleTranslation: "桑托斯先生不是学生。",
      tip: "「じゃ ありません」是口语形式，书面语用「では ありません」。",
    },
    {
      id: "1-3",
      name: "〜は 〜ですか",
      meaning: "～是～吗？（疑问句）",
      connection: "名词 + は + 名词 + ですか",
      example: "ミラーさんは アメリカ人ですか。",
      exampleTranslation: "米勒先生是美国人吗？",
      tip: "日语疑问句在句尾加「か」，不需要改变语序。",
    },
    {
      id: "1-4",
      name: "〜も",
      meaning: "～也（表示同类）",
      connection: "名词 + も + 述语",
      example: "ミラーさんも 会社員です。",
      exampleTranslation: "米勒先生也是公司职员。",
    },
  ],
  2: [
    {
      id: "2-1",
      name: "これ / それ / あれ",
      meaning: "这个 / 那个 / 那个（远处）",
      connection: "これ/それ/あれ + は + 名词 + です",
      example: "これは 辞書です。",
      exampleTranslation: "这是词典。",
      tip: "これ（近说话人）、それ（近听话人）、あれ（远离双方）。",
    },
    {
      id: "2-2",
      name: "〜の 〜（所属）",
      meaning: "～的～（表示所属关系）",
      connection: "名词 + の + 名词",
      example: "これは コンピューターの 本です。",
      exampleTranslation: "这是电脑方面的书。",
    },
  ],
};

export default function GrammarPage() {
  const { currentLesson } = useLessonStore();
  const [points, setPoints] = useState<GrammarPoint[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const raw = MOCK_GRAMMAR[currentLesson] || MOCK_GRAMMAR[1] || [];
      const masteryMap = await getMasteryMap(currentLesson, "grammar");
      setPoints(
        raw.map((p) => ({
          ...p,
          mastery: masteryMap[p.id] as MasteryLevel | undefined,
        }))
      );
      setExpandedId(null);
    }
    load();
  }, [currentLesson]);

  const handleMastery = async (id: string, level: MasteryLevel) => {
    setPoints((prev) =>
      prev.map((p) => (p.id === id ? { ...p, mastery: level } : p))
    );
    await saveMastery(currentLesson, "grammar", id, level);
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-text">
          语法精讲
          <span className="text-text-muted font-normal ml-2 text-sm">
            ぶんぽう
          </span>
        </h1>
        <p className="text-xs text-text-muted mt-1">
          第 {currentLesson} 課 · {points.length} 个语法点
        </p>
      </div>

      <div className="space-y-3">
        {points.map((point) => {
          const isExpanded = expandedId === point.id;
          return (
            <div
              key={point.id}
              className="bg-bg-card border border-border rounded-xl overflow-hidden
                         hover:border-primary/20 transition-colors"
            >
              {/* Header */}
              <button
                onClick={() => setExpandedId(isExpanded ? null : point.id)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left"
              >
                {isExpanded ? (
                  <ChevronDown size={16} className="text-primary shrink-0" />
                ) : (
                  <ChevronRight size={16} className="text-text-muted shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-text-muted font-mono">
                      {point.id}
                    </span>
                    <span className="font-medium text-text text-sm">
                      {point.name}
                    </span>
                  </div>
                  <p className="text-xs text-text-secondary mt-0.5">
                    {point.meaning}
                  </p>
                </div>
              </button>

              {/* Detail */}
              <div
                className={cn(
                  "overflow-hidden transition-all duration-200",
                  isExpanded ? "max-h-96" : "max-h-0"
                )}
              >
                <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
                  <div>
                    <span className="text-[11px] text-text-muted uppercase tracking-wider">
                      接续方式
                    </span>
                    <p className="text-sm text-text mt-1 font-mono bg-bg rounded-lg px-3 py-2">
                      {point.connection}
                    </p>
                  </div>

                  <div>
                    <span className="text-[11px] text-text-muted uppercase tracking-wider">
                      例句
                    </span>
                    <p className="text-sm text-text mt-1">{point.example}</p>
                    <p className="text-xs text-text-secondary mt-0.5">
                      {point.exampleTranslation}
                    </p>
                  </div>

                  {point.tip && (
                    <div className="bg-accent-light/20 rounded-lg px-3 py-2">
                      <span className="text-[11px] text-accent font-medium">
                        注意
                      </span>
                      <p className="text-xs text-text-secondary mt-0.5">
                        {point.tip}
                      </p>
                    </div>
                  )}

                  <MasteryButtons
                    current={point.mastery}
                    onChange={(level) => handleMastery(point.id, level)}
                    size="sm"
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
