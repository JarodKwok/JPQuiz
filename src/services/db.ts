import Dexie, { type Table } from "dexie";
import type {
  LearningProgress,
  MasteryStatus,
  WrongAnswer,
  StudySession,
  Module,
} from "@/types";
import type { QuizSessionRecord } from "@/types/quiz";

/** AI 生成内容的缓存 */
export interface ContentCache {
  id?: number;
  lessonId: number;
  module: Module;
  content: string; // JSON string
  version: string;
  createdAt: string;
  updatedAt: string;
}

class JPQuizDB extends Dexie {
  learningProgress!: Table<LearningProgress>;
  masteryStatus!: Table<MasteryStatus>;
  wrongAnswers!: Table<WrongAnswer>;
  studySessions!: Table<StudySession>;
  contentCache!: Table<ContentCache>;
  quizSessions!: Table<QuizSessionRecord>;

  constructor() {
    super("jpquiz");
    this.version(3).stores({
      learningProgress: "++id, lessonId, module, updatedAt",
      masteryStatus: "++id, lessonId, module, status, [lessonId+module+itemKey]",
      wrongAnswers: "++id, lessonId, module, status",
      studySessions: "++id, date, module",
      contentCache: "++id, [lessonId+module], updatedAt",
    });
    this.version(4).stores({
      learningProgress: "++id, lessonId, module, updatedAt",
      masteryStatus: "++id, lessonId, module, status, [lessonId+module+itemKey]",
      wrongAnswers: "++id, lessonId, module, status",
      studySessions: "++id, date, module",
      contentCache: "++id, [lessonId+module], updatedAt",
      quizSessions: "++id, lessonId, module, questionType, sourceType, createdAt",
    });
  }
}

export const db = new JPQuizDB();
