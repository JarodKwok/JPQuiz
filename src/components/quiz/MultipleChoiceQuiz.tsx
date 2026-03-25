"use client";

import { useState } from "react";
import { CheckCircle2, XCircle, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import type { QuizData, QuizAnswer, QuizResult } from "@/types/quiz";

interface MultipleChoiceQuizProps {
  quiz: QuizData;
  onComplete?: (results: QuizResult[]) => void;
}

export default function MultipleChoiceQuiz({
  quiz,
  onComplete,
}: MultipleChoiceQuizProps) {
  const [answers, setAnswers] = useState<Record<number, number | null>>({});
  const [submitted, setSubmitted] = useState(false);
  const [results, setResults] = useState<QuizResult[]>([]);

  const handleSelect = (questionId: number, optionIndex: number) => {
    if (submitted) return;
    setAnswers((prev) => ({ ...prev, [questionId]: optionIndex }));
  };

  const handleSubmit = () => {
    const quizResults: QuizResult[] = quiz.questions.map((q) => ({
      questionId: q.id,
      selectedIndex: answers[q.id] ?? -1,
      correctIndex: q.correctIndex,
      isCorrect: answers[q.id] === q.correctIndex,
    }));
    setResults(quizResults);
    setSubmitted(true);
    onComplete?.(quizResults);
  };

  const answeredCount = Object.values(answers).filter(
    (v) => v !== null && v !== undefined
  ).length;
  const totalCount = quiz.questions.length;
  const correctCount = results.filter((r) => r.isCorrect).length;

  return (
    <div className="space-y-4">
      {/* Quiz header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-text">{quiz.title}</h3>
        {submitted && (
          <span
            className={cn(
              "text-xs font-medium px-2.5 py-1 rounded-full",
              correctCount === totalCount
                ? "bg-emerald-100 text-emerald-700"
                : correctCount >= totalCount / 2
                  ? "bg-amber-100 text-amber-700"
                  : "bg-red-100 text-red-700"
            )}
          >
            {correctCount}/{totalCount} 正确
          </span>
        )}
      </div>

      {/* Questions */}
      {quiz.questions.map((q) => {
        const selected = answers[q.id];
        const result = results.find((r) => r.questionId === q.id);

        return (
          <div
            key={q.id}
            className="bg-bg border border-border rounded-xl p-4 space-y-3"
          >
            {/* Question text */}
            <p className="text-sm font-medium text-text">
              <span className="text-primary mr-1.5">{q.id}.</span>
              {q.question}
            </p>

            {/* Options */}
            <div className="grid gap-2">
              {q.options.map((option, idx) => {
                const isSelected = selected === idx;
                const isCorrect = submitted && idx === q.correctIndex;
                const isWrong = submitted && isSelected && idx !== q.correctIndex;

                return (
                  <button
                    key={idx}
                    onClick={() => handleSelect(q.id, idx)}
                    disabled={submitted}
                    className={cn(
                      "flex items-center gap-3 w-full text-left px-4 py-2.5 rounded-lg border text-sm transition-all",
                      // Default state
                      !submitted && !isSelected &&
                        "border-border text-text-secondary hover:border-primary/40 hover:bg-primary/5",
                      // Selected (before submit)
                      !submitted && isSelected &&
                        "border-primary bg-primary/10 text-primary font-medium",
                      // Correct answer (after submit)
                      isCorrect &&
                        "border-emerald-400 bg-emerald-50 text-emerald-700 font-medium",
                      // Wrong answer (after submit)
                      isWrong &&
                        "border-red-400 bg-red-50 text-red-600 line-through",
                      // Not selected, not correct (after submit)
                      submitted && !isCorrect && !isWrong &&
                        "border-border/50 text-text-muted"
                    )}
                  >
                    <span className="shrink-0 w-5 h-5 flex items-center justify-center">
                      {isCorrect ? (
                        <CheckCircle2 size={16} className="text-emerald-500" />
                      ) : isWrong ? (
                        <XCircle size={16} className="text-red-500" />
                      ) : (
                        <span
                          className={cn(
                            "w-4 h-4 rounded-full border-2",
                            isSelected ? "border-primary bg-primary" : "border-border"
                          )}
                        />
                      )}
                    </span>
                    <span>{option}</span>
                  </button>
                );
              })}
            </div>

            {/* Explanation after submit */}
            {submitted && q.explanation && (
              <div className="mt-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-xs text-blue-700">
                  <span className="font-medium">解析：</span>
                  {q.explanation}
                </p>
              </div>
            )}
          </div>
        );
      })}

      {/* Submit button */}
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
