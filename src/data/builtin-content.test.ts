import { describe, expect, it } from "vitest";
import { BUILTIN_LESSON_CONTENT, getBuiltinModuleContent } from "./builtin-content";

describe("builtin lesson content", () => {
  it("covers all 25 lessons", () => {
    expect(Object.keys(BUILTIN_LESSON_CONTENT)).toHaveLength(25);

    for (let lessonId = 1; lessonId <= 25; lessonId++) {
      const lesson = BUILTIN_LESSON_CONTENT[lessonId];
      expect(lesson).toBeDefined();
      expect(lesson.vocabulary.length).toBeGreaterThanOrEqual(10);
      expect(lesson.grammar.length).toBeGreaterThanOrEqual(3);
      expect(lesson.examples.patterns.length).toBeGreaterThanOrEqual(3);
      expect(lesson.examples.examples.length).toBeGreaterThanOrEqual(4);
      expect(lesson.text.lines.length).toBeGreaterThanOrEqual(4);
    }
  });

  it("provides rich lesson 5 vocabulary content", () => {
    const vocabulary = getBuiltinModuleContent(5, "vocabulary");
    expect(vocabulary).not.toBeNull();
    expect(vocabulary?.length).toBeGreaterThanOrEqual(12);
    expect(vocabulary?.some((item) => item.word === "でんしゃ")).toBe(true);
    expect(vocabulary?.some((item) => item.word === "くうこう")).toBe(true);
  });
});
