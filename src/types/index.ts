import type { QuizQuestionType, QuizSourceType } from "./quiz";

// AI Types
export interface AIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AIRequestOptions {
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

export interface AIResponse {
  content: string;
  usage?: { promptTokens: number; completionTokens: number };
}

export interface AIProviderConfig {
  apiKey: string;
  model: string;
  baseUrl: string;
  wireApi?: "chat" | "responses";
}

export type AITeachingStyle = "concise" | "structured" | "coach";
export type AIAnswerFormatPreference = "table-first" | "bullet-first" | "mixed";

export interface AIMemoryPolicySettings {
  recentTurns: number;
  weakItemsLimit: number;
  recentWrongAnswersLimit: number;
  summarizeEveryTurns: number;
  maxLongTermMemoriesPerRequest: number;
  totalSoftTokenLimit: number;
  moduleContextItemsLimit: number;
}

export interface AITutorSettings {
  assistantName: string;
  customTutorPrompt: string;
  teachingStyle: AITeachingStyle;
  answerFormatPreference: AIAnswerFormatPreference;
  memoryPolicy: AIMemoryPolicySettings;
}

export interface AISettings {
  activeProvider: string;
  providers: Record<string, AIProviderConfig>;
  tutor: AITutorSettings;
}

export type AIConversationRole = "user" | "assistant";

export interface AIConversation {
  id?: number;
  ownerId: string;
  title: string;
  lessonId: number;
  module: Module;
  createdAt: string;
  updatedAt: string;
  lastMessageAt: string;
}

export interface AIConversationMessage {
  id?: number;
  conversationId: number;
  ownerId: string;
  role: AIConversationRole;
  content: string;
  createdAt: string;
}

export interface AIConversationSummary {
  id?: number;
  conversationId: number;
  ownerId: string;
  summary: string;
  messageCount: number;
  updatedAt: string;
}

export type AILongTermMemoryKind =
  | "preference"
  | "weak_point"
  | "goal"
  | "summary";

export interface AILongTermMemory {
  id?: number;
  ownerId: string;
  kind: AILongTermMemoryKind;
  text: string;
  score: number;
  source: string;
  createdAt: string;
  updatedAt: string;
  lastUsedAt?: string;
}

// Learning Types
export const MODULES = [
  "vocabulary",
  "grammar",
  "text",
  "examples",
  "listening",
] as const;

export type Module = (typeof MODULES)[number];

export type MasteryLevel = "mastered" | "fuzzy" | "weak" | "new";

export interface LearningProgress {
  id?: number;
  lessonId: number;
  module: Module;
  masteryPercent: number;
  totalItems?: number;
  lastStudiedAt?: string;
  updatedAt: string;
}

export interface MasteryStatus {
  id?: number;
  lessonId: number;
  module: Module;
  itemKey: string;
  status: MasteryLevel;
  reviewCount: number;
  lastReviewedAt?: string;
  createdAt: string;
}

export interface WrongAnswer {
  id?: number;
  lessonId: number;
  module: Module;
  question: string;
  userAnswer?: string;
  correctAnswer: string;
  errorReason?: string;
  status: "mastered" | "weak";
  questionType?: QuizQuestionType;
  sourceType?: QuizSourceType;
  knowledgeKeys?: string[];
  createdAt: string;
}

export interface StudySession {
  id?: number;
  date: string;
  durationSeconds: number;
  module?: Module;
  lessonId?: number;
}
