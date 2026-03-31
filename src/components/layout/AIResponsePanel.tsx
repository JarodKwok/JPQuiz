"use client";

import { useMemo } from "react";
import { X, Loader2, PlusSquare } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import MultipleChoiceQuiz from "@/components/quiz/MultipleChoiceQuiz";
import { parseQuizPayload } from "@/services/quiz";
import type { QuizData, QuizSubmission } from "@/types/quiz";
import type { AIConversationMessage, Module } from "@/types";
import { saveWrongAnswer } from "@/services/wrongAnswers";
import { saveMastery } from "@/services/mastery";

interface AIResponsePanelProps {
  title: string;
  messages: AIConversationMessage[];
  loading: boolean;
  lessonId: number;
  module: Module;
  onNewConversation: () => void;
  onClose: () => void;
}

function MarkdownMessage({ content }: { content: string }) {
  return (
    <div className="text-sm text-text leading-7">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
          ul: ({ children }) => (
            <ul className="mb-3 list-disc pl-5 space-y-1">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="mb-3 list-decimal pl-5 space-y-1">{children}</ol>
          ),
          li: ({ children }) => <li className="text-text">{children}</li>,
          strong: ({ children }) => (
            <strong className="font-semibold text-text">{children}</strong>
          ),
          h1: ({ children }) => (
            <h1 className="text-base font-semibold text-text mb-3">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-[15px] font-semibold text-text mb-3">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-sm font-semibold text-text mb-2">{children}</h3>
          ),
          pre: ({ children }) => (
            <pre className="mb-3 overflow-x-auto rounded-xl border border-border bg-bg-card p-3 text-[13px] leading-6 text-text">
              {children}
            </pre>
          ),
          code: ({ className, children }) => {
            const language = className?.replace("language-", "");
            return (
              <>
                {language ? (
                  <span className="mb-2 block text-[11px] uppercase tracking-wide text-text-muted">
                    {language}
                  </span>
                ) : null}
                <code className="rounded bg-bg-card px-1.5 py-0.5 text-[13px] text-primary">
                  {children}
                </code>
              </>
            );
          },
          table: ({ children }) => (
            <div className="mb-3 overflow-x-auto rounded-xl border border-border">
              <table className="min-w-full border-collapse text-sm">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-bg-card">{children}</thead>,
          tbody: ({ children }) => <tbody>{children}</tbody>,
          tr: ({ children }) => (
            <tr className="border-b border-border last:border-b-0">{children}</tr>
          ),
          th: ({ children }) => (
            <th className="px-3 py-2 text-left font-medium text-text">{children}</th>
          ),
          td: ({ children }) => (
            <td className="px-3 py-2 align-top text-text-secondary">{children}</td>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="text-primary underline underline-offset-2"
            >
              {children}
            </a>
          ),
          blockquote: ({ children }) => (
            <blockquote className="mb-3 border-l-2 border-primary/30 pl-3 text-text-secondary">
              {children}
            </blockquote>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
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
  title,
  messages,
  loading,
  lessonId,
  module,
  onNewConversation,
  onClose,
}: AIResponsePanelProps) {
  const parsedMessages = useMemo(
    () =>
      messages.map((message) => ({
        ...message,
        parsed:
          message.role === "assistant" && message.content
            ? parseQuizFromContent(message.content)
            : null,
      })),
    [messages]
  );

  const handleQuizComplete = (quiz: QuizData, submission: QuizSubmission) => {
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
            <span>{title || "AI 助手"}</span>
            {loading && (
              <>
                <Loader2 size={12} className="animate-spin" />
                <span>思考中...</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={onNewConversation}
              className="inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] text-text-muted hover:bg-border/50"
            >
              <PlusSquare size={13} />
              新对话
            </button>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-border/50 text-text-muted"
          >
            <X size={14} />
          </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-4 py-3 max-h-[60vh] overflow-y-auto">
          {loading && messages.length === 0 && (
            <p className="text-sm text-text-muted">正在生成回答...</p>
          )}

          {!loading && messages.length === 0 && (
            <p className="text-sm text-text-muted">
              这里会保留当前对话线程。你可以继续追问，AI 会基于最近几轮内容作答。
            </p>
          )}

          <div className="space-y-4">
            {parsedMessages.map((message, index) => (
              <div
                key={message.id || `${message.role}-${message.createdAt}-${index}`}
                className={
                  message.role === "user"
                    ? "ml-auto max-w-[88%] rounded-2xl bg-primary text-white px-4 py-3"
                    : "mr-auto max-w-[92%] rounded-2xl border border-border bg-bg px-4 py-3"
                }
              >
                {message.role === "user" ? (
                  <div className="text-sm leading-relaxed whitespace-pre-wrap">
                    {message.content}
                  </div>
                ) : (
                  <>
                    {!message.content && loading && !message.id && (
                      <div className="text-sm text-text-muted">
                        <Loader2 size={14} className="inline animate-spin mr-2" />
                        正在生成回答...
                      </div>
                    )}

                    {message.parsed?.textBefore && (
                      <div className="mb-4">
                        <MarkdownMessage content={message.parsed.textBefore} />
                      </div>
                    )}

                    {message.parsed?.quiz && (
                      <MultipleChoiceQuiz
                        key={`${lessonId}-${module}-${message.parsed.quiz.title}-${message.parsed.quiz.questions.length}-${index}`}
                        quiz={message.parsed.quiz}
                        onComplete={(submission) =>
                          handleQuizComplete(message.parsed!.quiz!, submission)
                        }
                      />
                    )}

                    {message.parsed?.textAfter && (
                      <div className="mt-4">
                        <MarkdownMessage content={message.parsed.textAfter} />
                      </div>
                    )}

                    {!message.parsed?.quiz &&
                      !message.parsed?.textBefore &&
                      message.content && (
                        <MarkdownMessage content={message.content} />
                      )}
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
