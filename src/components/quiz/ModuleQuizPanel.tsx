"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2, Sparkles, Target, Wand2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Module } from "@/types";
import type { ModuleContent } from "@/types/content";
import type {
  QuizData,
  QuizDraftAnswer,
  QuizQuestionType,
  QuizResolvedTarget,
  QuizSourceType,
  QuizSubmission,
} from "@/types/quiz";
import {
  generateModuleQuiz,
  getQuizTargetPools,
  persistQuizSubmission,
  resolveQuizTargets,
} from "@/services/quiz";
import { AIRequestError } from "@/services/ai/client";
import { useModuleUIStore } from "@/stores/moduleUIStore";
import StructuredQuiz from "./StructuredQuiz";

interface QuizErrorState {
  text: string;
  action?: { href: string; label: string };
}

/**
 * 把组卷过程的 AI 错误翻译成用户能看懂的话。
 * 触发场景：题库不够 → 兜底 AI → 命中配额 / 服务未配置 / 未登录。
 */
function quizErrorState(err: unknown): QuizErrorState {
  if (err instanceof AIRequestError) {
    if (err.code === "quota_exhausted") {
      return err.isPremium
        ? { text: "本月会员配额已用完，下月初自动恢复；可缩小筛选范围让题库直接出题。" }
        : {
            text: "题库中此筛选条件下题目不足，AI 实时生成需要开通会员；可改换筛选范围或题型再试。",
            action: { href: "/subscribe", label: "开通会员" },
          };
    }
    if (err.code === "service_not_configured") {
      return { text: "AI 服务尚未配置，请联系管理员。" };
    }
    if (err.code === "unauthenticated") {
      return { text: "登录已过期，请重新登录后再试。" };
    }
    return { text: `AI 生成失败：${err.serverMessage}` };
  }
  return { text: err instanceof Error ? err.message : "测验生成失败。" };
}

interface ModuleQuizPanelProps<M extends Module> {
  module: M;
  lessonId: number;
  content: ModuleContent<M> | null;
  contentLoading?: boolean;
  contentError?: string;
}

const QUESTION_TYPES: Array<{ value: QuizQuestionType; label: string }> = [
  { value: "multiple_choice", label: "选择题" },
  { value: "fill_blank", label: "填空题" },
  { value: "translation", label: "问答题（翻译）" },
];

const SOURCE_TYPES: Array<{ value: QuizSourceType; label: string; hint: string }> = [
  {
    value: "random_scope",
    label: "当前范围随机",
    hint: "按当前课次和专题随机生成题目",
  },
  {
    value: "manual_targets",
    label: "指定内容",
    hint: "用你指定的词、语法点或句子出题",
  },
  {
    value: "weak_items",
    label: "错题 / 薄弱项",
    hint: "优先考你之前不会或答错的内容",
  },
  {
    value: "mixed",
    label: "混合强化",
    hint: "混合当前范围、薄弱项和指定目标组卷",
  },
];

const COUNT_OPTIONS = [3, 5, 10];

export default function ModuleQuizPanel<M extends Module>({
  module,
  lessonId,
  content,
  contentLoading,
  contentError,
}: ModuleQuizPanelProps<M>) {
  // 从 store 恢复测验状态（模块切换后保留）
  const { getQuizState, setQuizState } = useModuleUIStore();
  const savedQuiz = getQuizState(lessonId, module);

  const [questionType, setQuestionType] =
    useState<QuizQuestionType>(savedQuiz.questionType);
  const [sourceType, setSourceType] =
    useState<QuizSourceType>(savedQuiz.sourceType);
  const [count, setCount] = useState(savedQuiz.count);
  const [targetInput, setTargetInput] = useState("");
  const [resolvedTargets, setResolvedTargets] = useState<QuizResolvedTarget[]>([]);
  const [allTargetCount, setAllTargetCount] = useState(0);
  const [weakTargetCount, setWeakTargetCount] = useState(0);
  const [loadingPools, setLoadingPools] = useState(false);
  const [resolvingTargets, setResolvingTargets] = useState(false);
  const [generatingQuiz, setGeneratingQuiz] = useState(false);
  const [savingResult, setSavingResult] = useState(false);
  const [quiz, setQuiz] = useState<QuizData | null>(savedQuiz.quiz);
  const [answers, setAnswers] = useState<Record<number, QuizDraftAnswer>>(savedQuiz.answers);
  const [submission, setSubmission] = useState<QuizSubmission | null>(savedQuiz.submission);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState<QuizErrorState | null>(null);

  // 同步测验状态到 store
  useEffect(() => {
    setQuizState(lessonId, module, {
      questionType, sourceType, count, quiz, answers, submission,
    });
  }, [questionType, sourceType, count, quiz, answers, submission, lessonId, module, setQuizState]);

  const supportsTargetInput =
    sourceType === "manual_targets" || sourceType === "mixed";

  useEffect(() => {
    setResolvedTargets([]);
    setQuiz(null);
    setFeedback("");
    setError(null);
  }, [lessonId, module]);

  useEffect(() => {
    if (!content) {
      setAllTargetCount(0);
      setWeakTargetCount(0);
      return;
    }

    let cancelled = false;
    setLoadingPools(true);

    void getQuizTargetPools({ lessonId, module, data: content })
      .then((pools) => {
        if (cancelled) return;
        setAllTargetCount(pools.allTargets.length);
        setWeakTargetCount(pools.weakTargets.length);
      })
      .catch(() => {
        if (cancelled) return;
        setAllTargetCount(0);
        setWeakTargetCount(0);
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingPools(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [content, lessonId, module]);

  const sourceMeta = useMemo(
    () => SOURCE_TYPES.find((item) => item.value === sourceType),
    [sourceType]
  );

  const handleResolveTargets = async () => {
    if (!content) return;
    if (!targetInput.trim()) {
      setResolvedTargets([]);
      setError({ text: "请先输入想重点练的词、语法点或句子。" });
      return;
    }

    setResolvingTargets(true);
    setError(null);
    setFeedback("");

    try {
      const targets = await resolveQuizTargets({
        lessonId,
        module,
        data: content,
        query: targetInput,
      });

      setResolvedTargets(targets);
      if (targets.length === 0) {
        setFeedback("暂时没有识别到明确目标，你可以换一种说法再试试。");
      } else {
        setFeedback(`已识别 ${targets.length} 个目标知识点。`);
      }
    } catch (err) {
      setError(quizErrorState(err));
    } finally {
      setResolvingTargets(false);
    }
  };

  const handleGenerateQuiz = async () => {
    if (!content) return;

    setGeneratingQuiz(true);
    setError(null);
    setFeedback("");

    try {
      let nextTargets = resolvedTargets;

      if (supportsTargetInput && targetInput.trim() && resolvedTargets.length === 0) {
        nextTargets = await resolveQuizTargets({
          lessonId,
          module,
          data: content,
          query: targetInput,
        });
        setResolvedTargets(nextTargets);
      }

      const generatedQuiz = await generateModuleQuiz({
        lessonId,
        module,
        data: content,
        questionType,
        sourceType,
        count,
        resolvedTargets: nextTargets,
      });

      setQuiz(generatedQuiz);
      setAnswers({});
      setSubmission(null);
      setFeedback("题目已生成，直接开始答题吧。");
    } catch (err) {
      setError(quizErrorState(err));
    } finally {
      setGeneratingQuiz(false);
    }
  };

  const handleSubmitQuiz = async (newSubmission: QuizSubmission) => {
    if (!content || !quiz) return;

    setSubmission(newSubmission);
    setSavingResult(true);
    setError(null);
    try {
      await persistQuizSubmission({
        lessonId,
        module,
        data: content,
        quiz,
        submission: newSubmission,
      });
      setFeedback(
        `本次测验已保存：${newSubmission.correctCount}/${newSubmission.totalQuestions} 正确，正确率 ${newSubmission.accuracy}%。`
      );
    } catch (err) {
      setError({ text: err instanceof Error ? err.message : "测验结果保存失败。" });
    } finally {
      setSavingResult(false);
    }
  };

  if (contentLoading) {
    return (
      <div className="bg-bg-card border border-border rounded-xl p-8 flex items-center justify-center gap-2 text-sm text-text-muted">
        <Loader2 size={18} className="animate-spin" />
        正在准备当前专题内容，稍后即可生成测验…
      </div>
    );
  }

  if (contentError) {
    return (
      <div className="bg-bg-card border border-border rounded-xl p-6 text-sm text-text-secondary">
        先完成学习内容加载后再生成测验：{contentError}
      </div>
    );
  }

  if (!content) {
    return (
      <div className="bg-bg-card border border-border rounded-xl p-6 text-sm text-text-secondary">
        当前还没有可用于组卷的内容。
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-bg-card border border-border rounded-xl p-4 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-medium text-text">智能组卷</h2>
            <p className="text-xs text-text-muted mt-1">
              当前专题共有 {allTargetCount} 个可出题知识点
              {loadingPools ? " · 正在分析薄弱项…" : ` · 薄弱项 ${weakTargetCount} 个`}
            </p>
          </div>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 text-primary px-2.5 py-1 text-xs">
            <Sparkles size={12} />
            AI 生成题目
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs text-text-muted">出题范围</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {SOURCE_TYPES.map((item) => (
              <button
                key={item.value}
                onClick={() => setSourceType(item.value)}
                className={cn(
                  "rounded-xl border p-3 text-left transition-colors",
                  sourceType === item.value
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/30"
                )}
              >
                <p className="text-sm font-medium text-text">{item.label}</p>
                <p className="text-[11px] text-text-muted mt-1">{item.hint}</p>
              </button>
            ))}
          </div>
          {sourceMeta && (
            <p className="text-[11px] text-text-muted">{sourceMeta.hint}</p>
          )}
        </div>

        {supportsTargetInput && (
          <div className="space-y-3">
            <div>
              <p className="text-xs text-text-muted mb-2">目标知识点</p>
              <textarea
                value={targetInput}
                onChange={(event) => {
                  setTargetInput(event.target.value);
                  setResolvedTargets([]);
                }}
                rows={3}
                placeholder="例如：老师、先生、これ / 用「〜は〜です」出题 / 第一句课文"
                className="w-full resize-y bg-bg border border-border rounded-xl px-3 py-2 text-sm text-text
                           placeholder:text-text-muted focus:outline-none focus:ring-2
                           focus:ring-primary/30 focus:border-primary"
              />
              <div className="mt-2 flex items-center justify-between gap-3">
                <p className="text-[11px] text-text-muted">
                  支持中文、日文、假名、语法关键词和句子片段
                </p>
                <button
                  onClick={() => void handleResolveTargets()}
                  disabled={resolvingTargets || !targetInput.trim()}
                  className={cn(
                    "inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors",
                    targetInput.trim()
                      ? "border-border text-text-secondary hover:border-primary/40 hover:text-primary"
                      : "border-border/60 text-text-muted cursor-not-allowed"
                  )}
                >
                  {resolvingTargets ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Target size={14} />
                  )}
                  识别目标
                </button>
              </div>
            </div>

            {resolvedTargets.length > 0 && (
              <div>
                <p className="text-xs text-text-muted mb-2">已识别目标</p>
                <div className="flex flex-wrap gap-2">
                  {resolvedTargets.map((target) => (
                    <span
                      key={target.key}
                      className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 text-primary px-3 py-1.5 text-xs"
                    >
                      {target.label}
                      <button
                        onClick={() =>
                          setResolvedTargets((prev) =>
                            prev.filter((item) => item.key !== target.key)
                          )
                        }
                        className="hover:text-primary-dark"
                        title="移除目标"
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            <p className="text-xs text-text-muted">题型</p>
            <div className="flex flex-wrap gap-2">
              {QUESTION_TYPES.map((item) => (
                <button
                  key={item.value}
                  onClick={() => setQuestionType(item.value)}
                  className={cn(
                    "text-sm px-3 py-2 rounded-lg border transition-colors",
                    questionType === item.value
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-text-secondary hover:border-primary/40 hover:text-primary"
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs text-text-muted">题量</p>
            <div className="flex flex-wrap gap-2">
              {COUNT_OPTIONS.map((item) => (
                <button
                  key={item}
                  onClick={() => setCount(item)}
                  className={cn(
                    "text-sm px-3 py-2 rounded-lg border transition-colors",
                    count === item
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-text-secondary hover:border-primary/40 hover:text-primary"
                  )}
                >
                  {item} 题
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => void handleGenerateQuiz()}
            disabled={generatingQuiz || resolvingTargets}
            className={cn(
              "inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors",
              generatingQuiz || resolvingTargets
                ? "bg-border/50 text-text-muted cursor-not-allowed"
                : "bg-primary text-white hover:bg-primary-dark"
            )}
          >
            {generatingQuiz ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Wand2 size={16} />
            )}
            生成测验
          </button>
          {savingResult && (
            <span className="inline-flex items-center gap-1.5 text-xs text-text-muted">
              <Loader2 size={12} className="animate-spin" />
              正在保存作答结果…
            </span>
          )}
        </div>

        {feedback && (
          <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-text-secondary">
            {feedback}
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 flex items-start justify-between gap-3">
            <span className="flex-1">{error.text}</span>
            {error.action && (
              <Link
                href={error.action.href}
                className="shrink-0 inline-flex items-center px-2.5 py-1 rounded-md bg-primary text-white text-xs font-medium hover:bg-primary/90 no-underline"
              >
                {error.action.label}
              </Link>
            )}
          </div>
        )}
      </div>

      {quiz && (
        <div className="bg-bg-card border border-border rounded-xl p-4">
          <StructuredQuiz
            key={`${module}-${lessonId}-${quiz.title}-${quiz.count}-${quiz.questionType}`}
            quiz={quiz}
            answers={answers}
            onAnswersChange={setAnswers}
            submission={submission}
            onComplete={handleSubmitQuiz}
          />
        </div>
      )}
    </div>
  );
}
