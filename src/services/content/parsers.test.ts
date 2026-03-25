import { describe, expect, it } from "vitest";
import { parseModuleContent } from "./parsers";

describe("content parsers", () => {
  it("parses vocabulary JSON payload", () => {
    const data = parseModuleContent(
      "vocabulary",
      JSON.stringify([
        {
          word: "先生",
          reading: "せんせい",
          meaning: "老师",
          example: "山田先生は 日本人です。",
        },
      ])
    );

    expect(data[0]?.word).toBe("先生");
  });

  it("parses grammar JSON from markdown code block", () => {
    const data = parseModuleContent(
      "grammar",
      [
        "```json",
        JSON.stringify([
          {
            id: "1-1",
            name: "〜は 〜です",
            meaning: "～是～",
            connection: "名词 + は + 名词 + です",
            example: "わたしは 学生です。",
            exampleTranslation: "我是学生。",
          },
        ]),
        "```",
      ].join("\n")
    );

    expect(data[0]?.id).toBe("1-1");
  });

  it("throws on invalid listening content", () => {
    expect(() =>
      parseModuleContent(
        "listening",
        JSON.stringify([
          { text: "a", options: ["1", "2"], answer: 3 },
        ])
      )
    ).toThrow("listening");
  });
});
