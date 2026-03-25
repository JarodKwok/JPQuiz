import { describe, expect, it } from "vitest";
import type { QuizData } from "@/types/quiz";
import {
  buildQuizTargetCandidates,
  gradeQuizSubmission,
  matchQuizTargetsLocally,
  parseQuizPayload,
} from "./quiz";

describe("quiz service", () => {
  it("builds vocabulary candidates and matches Chinese/Japanese inputs", () => {
    const candidates = buildQuizTargetCandidates(5, "vocabulary", [
      {
        word: "先生",
        reading: "せんせい",
        meaning: "老师",
        example: "山田先生は 日本人です。",
      },
      {
        word: "銀行",
        reading: "ぎんこう",
        meaning: "银行",
      },
    ]);

    expect(candidates).toHaveLength(2);
    expect(matchQuizTargetsLocally("老师", candidates)[0]?.key).toBe("先生");
    expect(matchQuizTargetsLocally("ぎんこう", candidates)[0]?.key).toBe("銀行");
  });

  it("parses legacy multiple choice quiz payloads", () => {
    const parsed = parseQuizPayload({
      type: "quiz",
      data: {
        title: "第5课 单词练习",
        questions: [
          {
            id: 1,
            question: "「先生」的读音是？",
            options: ["せんせい", "ぎんこう", "がくせい", "かいしゃいん"],
            correctIndex: 0,
            explanation: "先生（せんせい）表示老师。",
          },
        ],
      },
    });

    expect(parsed.questions[0]?.type).toBe("multiple_choice");
    expect(parsed.questions[0]?.prompt).toBe("「先生」的读音是？");
  });

  it("parses structured fill blank payloads", () => {
    const parsed = parseQuizPayload({
      type: "quiz",
      data: {
        title: "第5课 单词填空",
        questionType: "fill_blank",
        questions: [
          {
            id: 1,
            type: "fill_blank",
            prompt: "请写出“老师”的日语。",
            answer: "先生",
            acceptedAnswers: ["せんせい"],
            knowledgeKeys: ["先生"],
          },
        ],
      },
    });

    expect(parsed.questionType).toBe("fill_blank");
    expect(parsed.questions[0]?.type).toBe("fill_blank");
  });

  it("grades multiple question types locally", () => {
    const quiz: QuizData = {
      title: "综合测验",
      questionType: "multiple_choice",
      questions: [
        {
          id: 1,
          type: "multiple_choice",
          prompt: "「先生」的意思是？",
          options: ["老师", "学生", "医生", "公司职员"],
          correctIndex: 0,
          knowledgeKeys: ["先生"],
        },
        {
          id: 2,
          type: "fill_blank",
          prompt: "请写出“银行”的日语。",
          answer: "銀行",
          acceptedAnswers: ["ぎんこう"],
          knowledgeKeys: ["銀行"],
        },
        {
          id: 3,
          type: "translation",
          prompt: "请将“我是老师。”翻译成日语。",
          direction: "zh-to-ja",
          answer: "わたしは先生です",
          acceptedAnswers: ["わたしはせんせいです"],
          knowledgeKeys: ["先生"],
        },
      ],
    };

    const submission = gradeQuizSubmission(quiz, {
      1: 0,
      2: " 銀行 ",
      3: "わたしは せんせいです。",
    });

    expect(submission.correctCount).toBe(3);
    expect(submission.accuracy).toBe(100);
  });
});
