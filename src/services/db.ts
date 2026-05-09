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
import type { QuizSessionRecord, QuizQuestionType } from "@/types/quiz";
import type { UserProfile } from "@/types/account";
import type { SystemLog } from "@/types/log";

/** 题库条目 */
export interface QuestionBankItem {
  id?: number;
  lessonId: number;
  module: string;
  questionType: QuizQuestionType;
  prompt: string;
  options?: string[];
  correctIndex?: number;
  answer?: string;
  acceptedAnswers?: string[];
  direction?: "zh-to-ja" | "ja-to-zh";
  knowledgeKeys: string[];
  explanation?: string;
}

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
  // Tables kept in IndexedDB (shared, client-side only)
  contentCache!: Table<ContentCache>;
  questionBank!: Table<QuestionBankItem>;

  // Tables retained for migration read-out only (data now lives on server)
  learningProgress!: Table<LearningProgress>;
  masteryStatus!: Table<MasteryStatus>;
  wrongAnswers!: Table<WrongAnswer>;
  studySessions!: Table<StudySession>;
  quizSessions!: Table<QuizSessionRecord>;
  aiConversations!: Table<AIConversation>;
  aiMessages!: Table<AIConversationMessage>;
  aiConversationSummaries!: Table<AIConversationSummary>;
  aiLongTermMemories!: Table<AILongTermMemory>;
  userProfiles!: Table<UserProfile>;
  systemLogs!: Table<SystemLog>;

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
    this.version(6).stores({
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
      questionBank: "++id, lessonId, module, questionType, [lessonId+module+questionType]",
    });
    this.version(7)
      .stores({
        learningProgress:
          "++id, ownerId, lessonId, module, [ownerId+lessonId+module]",
        masteryStatus:
          "++id, ownerId, lessonId, module, status, [ownerId+lessonId+module+itemKey]",
        wrongAnswers: "++id, ownerId, lessonId, module, status",
        studySessions: "++id, ownerId, date, module",
        contentCache: "++id, [lessonId+module], updatedAt",
        quizSessions:
          "++id, ownerId, lessonId, module, questionType, sourceType, createdAt",
        aiConversations: "++id, ownerId, updatedAt, lastMessageAt",
        aiMessages: "++id, conversationId, ownerId, role, createdAt",
        aiConversationSummaries: "++id, conversationId, ownerId, updatedAt",
        aiLongTermMemories:
          "++id, ownerId, kind, score, updatedAt, lastUsedAt",
        questionBank:
          "++id, lessonId, module, questionType, [lessonId+module+questionType]",
        userProfiles: "id, displayName, createdAt, lastActiveAt",
      })
      .upgrade((tx) => {
        const defaultOwner = "local-default";
        const tables = [
          "learningProgress",
          "masteryStatus",
          "wrongAnswers",
          "studySessions",
          "quizSessions",
        ] as const;
        const promises = tables.map((name) =>
          tx
            .table(name)
            .toCollection()
            .modify((record: Record<string, unknown>) => {
              if (!record.ownerId) {
                record.ownerId = defaultOwner;
              }
            })
        );
        const now = new Date().toISOString();
        promises.push(
          tx.table("userProfiles").add({
            id: defaultOwner,
            displayName: "默认用户",
            avatarEmoji: "🌸",
            role: "admin",
            createdAt: now,
            lastActiveAt: now,
          })
        );
        return Promise.all(promises) as unknown as void;
      });
    this.version(8)
      .stores({
        userProfiles: "id, displayName, role, createdAt, lastActiveAt",
      })
      .upgrade((tx) =>
        tx
          .table("userProfiles")
          .toCollection()
          .modify((profile: Record<string, unknown>) => {
            if (!profile.role) {
              profile.role = "admin";
            }
          })
      );
    this.version(9).stores({
      systemLogs: "++id, ownerId, category, level, createdAt",
    });
  }
}

export const db = new JPQuizDB();
