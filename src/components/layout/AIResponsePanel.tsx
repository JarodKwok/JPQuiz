"use client";

import { useMemo } from "react";
import { X, Loader2 } from "lucide-react";
import MultipleChoiceQuiz from "@/components/quiz/MultipleChoiceQuiz";
import { parseQuizPayload } from "@/services/quiz";
import type { QuizData, QuizSubmission } from "@/types/quiz";
import type { Module } from "@/types";
import { saveWrongAnswer } from "@/services/wrongAnswers";
import { saveMastery } from "@/services/mastery";

interface AIResponsePanelProps {
  content: string;
  loading: boolean;
  lessonId: number;
  module: Module;
  onClose: () => void;
}

/** 尝试从 AI 返回的文本中解析出 Quiz JSON */
function parseQuizFromContent(content: string): { quiz: QuizData | null; textBefore: string; textAfter: string } {
  const trimmed = content.trim();

  // 尝试直接解析整段为 JSON
  try {
    const parsed = parseQuizPayload(JSON.parse(trimmed));
    if (parsed.questions.length > 0) {
      return { quiz: parsed, textBefore: "", textAfter: "" };
    }
  } catch {
    // not pure JSON
  }

  // 尝试从 markdown 代码块中提取
  const codeBlockRegex = /```(?:json)?\s*\n?([\s\S]*?)\n?```/;
  const match = trimmed.match(codeBlockRegex);
  if (match) {
    try {
      const parsed = parseQuizPayload(JSON.parse(match[1].trim()));
      if (parsed.questions.length > 0) {
        const idx = trimmed.indexOf(match[0]);
        return {
          quiz: parsed,
          textBefore: trimmed.slice(0, idx).trim(),
          textAfter: trimmed.slice(idx + match[0].length).trim(),
        };
      }
    } catch {
      // not valid quiz JSON
    }
  }

  // 尝试找到 JSON 对象边界 { ... }
  const jsonStart = trimmed.indexOf('{"type":"quiz"');
  const jsonStartAlt = trimmed.indexOf('{ "type": "quiz"');
  const start = jsonStart !== -1 ? jsonStart : jsonStartAlt;
  if (start !== -1) {
    // Find matching closing brace
    let depth = 0;
    let end = -1;
    for (let i = start; i < trimmed.length; i++) {
      if (trimmed[i] === "{") depth++;
      else if (trimmed[i] === "}") {
        depth--;
        if (depth === 0) {
          end = i + 1;
          break;
        }
      }
    }
    if (end !== -1) {
      try {
        const parsed = parseQuizPayload(JSON.parse(trimmed.slice(start, end)));
        if (parsed.questions.length > 0) {
          return {
            quiz: parsed,
            textBefore: trimmed.slice(0, start).trim(),
            textAfter: trimmed.slice(end).trim(),
          };
        }
      } catch {
        // not valid JSON
      }
    }
  }

  return { quiz: null, textBefore: content, textAfter: "" };
}

export default function AIResponsePanel({
  content,
  loading,
  lessonId,
  module,
  onClose,
}: AIResponsePanelProps) {
  const parsed = useMemo(() => {
    if (!content || loading) return null;
    return parseQuizFromContent(content);
  }, [content, loading]);

  const handleQuizComplete = (submission: QuizSubmission) => {
    const quiz = parsed?.quiz;
    if (!quiz) return;

    void Promise.all(
      submission.results.map(async (result) => {
        const question = quiz.questions.find(
          (item) => item.id === result.questionId
        );
        if (!question) return;

        const knowledgeKeys =
          result.knowledgeKeys.length > 0
            ? result.knowledgeKeys
            : [`quiz:${lessonId}:${module}:${question.id}`];

        await Promise.all(
          knowledgeKeys.map((itemKey) =>
            saveMastery(
              lessonId,
              module,
              itemKey,
              result.isCorrect ? "mastered" : "weak"
            )
          )
        );

        if (!result.isCorrect) {
          await saveWrongAnswer({
            lessonId,
            module,
            question: question.prompt,
            userAnswer:
              typeof result.userAnswer === "number"
                ? question.type === "multiple_choice"
                  ? question.options[result.userAnswer] || ""
                  : String(result.userAnswer)
                : result.userAnswer || "",
            correctAnswer: result.correctAnswer,
            errorReason: question.explanation,
            questionType: question.type,
            sourceType: quiz.sourceType,
            knowledgeKeys: result.knowledgeKeys,
          });
        }
      })
    );
  };

  return (
    <div className="border-t border-border bg-bg-card shrink-0">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-border/50">
          <div className="flex items-center gap-2 text-xs text-text-muted">
            <span>🤖</span>
            <span>AI 助手</span>
            {loading && (
              <>
                <Loader2 size={12} className="animate-spin" />
                <span>思考中...</span>
              </>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-border/50 text-text-muted"
          >
            <X size={14} />
          </button>
        </div>

        {/* Content */}
        <div className="px-4 py-3 max-h-[60vh] overflow-y-auto">
          {loading && !content && (
            <p className="text-sm text-text-muted">正在生成回答...</p>
          )}

          {/* Streaming 中还未完成，显示纯文本 */}
          {loading && content && (
            <div className="text-sm text-text leading-relaxed whitespace-pre-wrap">
              {content}
            </div>
          )}

          {/* 完成后：解析结构化内容 */}
          {!loading && parsed && (
            <>
              {/* 前置文字 */}
              {parsed.textBefore && (
                <div className="text-sm text-text leading-relaxed whitespace-pre-wrap mb-4">
                  {parsed.textBefore}
                </div>
              )}

              {/* 交互式测验 */}
              {parsed.quiz && (
                <MultipleChoiceQuiz
                  key={`${lessonId}-${module}-${parsed.quiz.title}-${parsed.quiz.questions.length}`}
                  quiz={parsed.quiz}
                  onComplete={handleQuizComplete}
                />
              )}

              {/* 纯文本（无测验时） */}
              {!parsed.quiz && parsed.textBefore && null}

              {/* 后置文字 */}
              {parsed.textAfter && (
                <div className="text-sm text-text leading-relaxed whitespace-pre-wrap mt-4">
                  {parsed.textAfter}
                </div>
              )}

              {/* 无测验的纯文本 */}
              {!parsed.quiz && !parsed.textBefore && content && (
                <div className="text-sm text-text leading-relaxed whitespace-pre-wrap">
                  {content}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
