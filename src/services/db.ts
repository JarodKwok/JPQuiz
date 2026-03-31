import Dexie, { type Table } from "dexie";
import type {
  LearningProgress,
  MasteryStatus,
  WrongAnswer,
  StudySession,
  Module,
  AIConversation,
  AIConversationMessage,
  AIConversationSummary,
  AILongTermMemory,
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
  aiConversations!: Table<AIConversation>;
  aiMessages!: Table<AIConversationMessage>;
  aiConversationSummaries!: Table<AIConversationSummary>;
  aiLongTermMemories!: Table<AILongTermMemory>;

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
    this.version(5).stores({
      learningProgress: "++id, lessonId, module, updatedAt",
      masteryStatus: "++id, lessonId, module, status, [lessonId+module+itemKey]",
      wrongAnswers: "++id, lessonId, module, status",
      studySessions: "++id, date, module",
      contentCache: "++id, [lessonId+module], updatedAt",
      quizSessions: "++id, lessonId, module, questionType, sourceType, createdAt",
      aiConversations: "++id, ownerId, updatedAt, lastMessageAt",
      aiMessages: "++id, conversationId, ownerId, role, createdAt",
      aiConversationSummaries: "++id, conversationId, ownerId, updatedAt",
      aiLongTermMemories: "++id, ownerId, kind, score, updatedAt, lastUsedAt",
    });
  }
}

export const db = new JPQuizDB();
