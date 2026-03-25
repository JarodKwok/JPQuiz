"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Send, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  QuizData,
  QuizDraftAnswer,
  QuizQuestion,
  QuizSubmission,
} from "@/types/quiz";
import { gradeQuizSubmission } from "@/services/quiz";

interface StructuredQuizProps {
  quiz: QuizData;
  onComplete?: (submission: QuizSubmission) => void | Promise<void>;
}

const QUESTION_TYPE_LABELS = {
  multiple_choice: "选择题",
  fill_blank: "填空题",
  translation: "翻译题",
} as const;

function isAnswered(question: QuizQuestion, value: QuizDraftAnswer) {
  if (question.type === "multiple_choice") {
    return typeof value === "number";
  }

  return typeof value === "string" && value.trim().length > 0;
}

export default function StructuredQuiz({
  quiz,
  onComplete,
}: StructuredQuizProps) {
  const [answers, setAnswers] = useState<Record<number, QuizDraftAnswer>>({});
  const [submitted, setSubmitted] = useState(false);
  const [submission, setSubmission] = useState<QuizSubmission | null>(null);

  const answeredCount = useMemo(
    () =>
      quiz.questions.filter((question) => isAnswered(question, answers[question.id]))
        .length,
    [answers, quiz.questions]
  );

  const totalCount = quiz.questions.length;
  const correctCount = submission?.correctCount || 0;

  const handleSubmit = () => {
    const nextSubmission = gradeQuizSubmission(quiz, answers);
    setSubmission(nextSubmission);
    setSubmitted(true);
    void onComplete?.(nextSubmission);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium text-text">{quiz.title}</h3>
          <p className="text-xs text-text-muted mt-1">
            {QUESTION_TYPE_LABELS[quiz.questionType || quiz.questions[0]?.type || "multiple_choice"]} · 共 {totalCount} 题
          </p>
        </div>
        {submitted && (
          <span
            className={cn(
              "text-xs font-medium px-2.5 py-1 rounded-full",
              correctCount === totalCount
                ? "bg-emerald-100 text-emerald-700"
                : correctCount >= Math.ceil(totalCount / 2)
                  ? "bg-amber-100 text-amber-700"
                  : "bg-red-100 text-red-700"
            )}
          >
            {correctCount}/{totalCount} 正确
          </span>
        )}
      </div>

      {quiz.questions.map((question, index) => {
        const answer = answers[question.id];
        const result = submission?.results.find(
          (item) => item.questionId === question.id
        );

        return (
          <div
            key={question.id}
            className="bg-bg border border-border rounded-xl p-4 space-y-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-text leading-relaxed">
                  <span className="text-primary mr-1.5">{index + 1}.</span>
                  {question.prompt}
                </p>
                <p className="text-[11px] text-text-muted mt-1">
                  {QUESTION_TYPE_LABELS[question.type]}
                </p>
              </div>
              {submitted && result && (
                <span className="shrink-0 mt-0.5">
                  {result.isCorrect ? (
                    <CheckCircle2 size={18} className="text-emerald-500" />
                  ) : (
                    <XCircle size={18} className="text-red-500" />
                  )}
                </span>
              )}
            </div>

            {question.type === "multiple_choice" && (
              <div className="grid gap-2">
                {question.options.map((option, optionIndex) => {
                  const isSelected = answer === optionIndex;
                  const isCorrect = submitted && optionIndex === question.correctIndex;
                  const isWrong =
                    submitted && isSelected && optionIndex !== question.correctIndex;

                  return (
                    <button
                      key={`${question.id}-${optionIndex}`}
                      onClick={() =>
                        setAnswers((prev) => ({
                          ...prev,
                          [question.id]: optionIndex,
                        }))
                      }
                      disabled={submitted}
                      className={cn(
                        "flex items-center gap-3 w-full text-left px-4 py-2.5 rounded-lg border text-sm transition-all",
                        !submitted &&
                          !isSelected &&
                          "border-border text-text-secondary hover:border-primary/40 hover:bg-primary/5",
                        !submitted &&
                          isSelected &&
                          "border-primary bg-primary/10 text-primary font-medium",
                        isCorrect &&
                          "border-emerald-400 bg-emerald-50 text-emerald-700 font-medium",
                        isWrong &&
                          "border-red-400 bg-red-50 text-red-600",
                        submitted &&
                          !isCorrect &&
                          !isWrong &&
                          "border-border/50 text-text-muted"
                      )}
                    >
                      <span className="text-xs font-mono opacity-60">
                        {String.fromCharCode(65 + optionIndex)}
                      </span>
                      <span>{option}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {question.type === "fill_blank" && (
              <input
                type="text"
                value={typeof answer === "string" ? answer : ""}
                onChange={(event) =>
                  setAnswers((prev) => ({
                    ...prev,
                    [question.id]: event.target.value,
                  }))
                }
                disabled={submitted}
                placeholder={question.placeholder || "请输入答案"}
                className="w-full bg-bg-card border border-border rounded-lg px-3 py-2 text-sm text-text
                           placeholder:text-text-muted focus:outline-none focus:ring-2
                           focus:ring-primary/30 focus:border-primary disabled:bg-bg"
              />
            )}

            {question.type === "translation" && (
              <textarea
                value={typeof answer === "string" ? answer : ""}
                onChange={(event) =>
                  setAnswers((prev) => ({
                    ...prev,
                    [question.id]: event.target.value,
                  }))
                }
                disabled={submitted}
                placeholder={question.placeholder || "请输入翻译结果"}
                rows={3}
                className="w-full resize-y bg-bg-card border border-border rounded-lg px-3 py-2 text-sm text-text
                           placeholder:text-text-muted focus:outline-none focus:ring-2
                           focus:ring-primary/30 focus:border-primary disabled:bg-bg"
              />
            )}

            {submitted && result && (
              <div
                className={cn(
                  "rounded-lg border px-3 py-2 space-y-1",
                  result.isCorrect
                    ? "border-emerald-200 bg-emerald-50"
                    : "border-red-200 bg-red-50"
                )}
              >
                <p
                  className={cn(
                    "text-xs font-medium",
                    result.isCorrect ? "text-emerald-700" : "text-red-700"
                  )}
                >
                  {result.isCorrect ? "回答正确" : "回答有误"}
                </p>
                {!result.isCorrect && (
                  <>
                    <p className="text-xs text-text-secondary">
                      你的答案：
                      <span className="ml-1 text-text">
                        {typeof result.userAnswer === "number"
                          ? question.type === "multiple_choice"
                            ? question.options[result.userAnswer] || "未选择"
                            : String(result.userAnswer)
                          : result.userAnswer || "未作答"}
                      </span>
                    </p>
                    <p className="text-xs text-text-secondary">
                      正确答案：
                      <span className="ml-1 text-text">{result.correctAnswer}</span>
                    </p>
                  </>
                )}
                {question.explanation && (
                  <p className="text-xs text-text-secondary">
                    解析：
                    <span className="ml-1 text-text">{question.explanation}</span>
                  </p>
                )}
              </div>
            )}
          </div>
        );
      })}

      {!submitted && (
        <button
          onClick={handleSubmit}
          disabled={answeredCount < totalCount}
          className={cn(
            "flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-medium transition-colors",
            answeredCount >= totalCount
              ? "bg-primary text-white hover:bg-primary-dark"
              : "bg-border/50 text-text-muted cursor-not-allowed"
          )}
        >
          <Send size={14} />
          提交答案（{answeredCount}/{totalCount}）
        </button>
      )}
    </div>
  );
}
