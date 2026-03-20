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

export interface AISettings {
  activeProvider: string;
  providers: Record<string, AIProviderConfig>;
}

// Learning Types
export type Module =
  | "vocabulary"
  | "grammar"
  | "text"
  | "examples"
  | "listening";

export type MasteryLevel = "mastered" | "fuzzy" | "weak" | "new";

export interface LearningProgress {
  id?: number;
  lessonId: number;
  module: Module;
  masteryPercent: number;
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
  createdAt: string;
}

export interface StudySession {
  id?: number;
  date: string;
  durationSeconds: number;
  module?: Module;
  lessonId?: number;
}
