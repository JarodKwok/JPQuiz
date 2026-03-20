import Dexie, { type Table } from "dexie";
import type {
  LearningProgress,
  MasteryStatus,
  WrongAnswer,
  StudySession,
} from "@/types";

class JPQuizDB extends Dexie {
  learningProgress!: Table<LearningProgress>;
  masteryStatus!: Table<MasteryStatus>;
  wrongAnswers!: Table<WrongAnswer>;
  studySessions!: Table<StudySession>;

  constructor() {
    super("jpquiz");
    this.version(1).stores({
      learningProgress: "++id, lessonId, module",
      masteryStatus: "++id, lessonId, module, status, [lessonId+module+itemKey]",
      wrongAnswers: "++id, lessonId, module, status",
      studySessions: "++id, date, module",
    });
  }
}

export const db = new JPQuizDB();
