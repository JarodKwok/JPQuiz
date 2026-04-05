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
            examples: [{ japanese: "わたしは 学生です。", translation: "我是学生。" }],
          },
        ]),
        "```",
      ].join("\n")
    );

    expect(data[0]?.id).toBe("1-1");
  });

  it("parses examples object payload", () => {
    const data = parseModuleContent(
      "examples",
      JSON.stringify({
        patterns: [
          {
            id: "5-P1",
            pattern: "〜へ 行きます",
            meaning: "去某地",
            structure: "地点 + へ + 行きます",
            sampleJapanese: "わたしは 駅へ 行きます。",
            sampleReading: "わたしは えきへ いきます。",
            sampleTranslation: "我去车站。",
          },
        ],
        examples: [
          {
            japanese: "あした 東京へ 行きます。",
            reading: "あした とうきょうへ いきます。",
            translation: "明天去东京。",
            grammar: "〜へ 行きます",
          },
        ],
      })
    );

    expect(data.patterns[0]?.id).toBe("5-P1");
    expect(data.examples[0]?.japanese).toBe("あした 東京へ 行きます。");
  });
});
