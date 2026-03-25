/** AI 返回的结构化测验题目 */
export interface QuizQuestion {
  id: number;
  question: string;
  options: string[];       // ["A. ...", "B. ...", "C. ...", "D. ..."]
  correctIndex: number;    // 正确答案的索引 (0-3)
  explanation?: string;    // 解析
}

export interface QuizData {
  title: string;
  questions: QuizQuestion[];
}

/** 用户答题状态 */
export interface QuizAnswer {
  questionId: number;
  selectedIndex: number | null;
}

export interface QuizResult {
  questionId: number;
  selectedIndex: number;
  correctIndex: number;
  isCorrect: boolean;
}

/** AI 响应的结构化内容类型 */
export type AIContentBlock =
  | { type: "text"; content: string }
  | { type: "quiz"; data: QuizData };
