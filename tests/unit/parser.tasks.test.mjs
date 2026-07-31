import assert from "node:assert/strict";
import test from "node:test";
import { parseDocument, parseMarkdown } from "../../core/parser/index.js";

test("valid Markdown task markers produce canonical task nodes", () => {
  assert.deepEqual(parseMarkdown([
    "- [ ] Vocabulary:",
    "- [x] Kanji",
    "- [X] Grammar",
    "  - [ ]   ",
  ].join("\n")), [
    { type: "task", checked: false, text: "Vocabulary:" },
    { type: "task", checked: true, text: "Kanji" },
    { type: "task", checked: true, text: "Grammar" },
    { type: "task", checked: false, text: "" },
  ]);
});

test("malformed task-like lines remain ordinary paragraphs", () => {
  const lines = [
    "- [] missing marker cell",
    "-[ ] missing separator",
    "- [y] unsupported marker",
    "- [ x ] spaced marker",
    "* [ ] unsupported bullet",
    "- [ ]missing content separator",
  ];

  assert.deepEqual(parseMarkdown(lines.join("\n")), lines.map((text) => ({
    type: "paragraph",
    text,
  })));
});

test("task-looking lines inside fences remain code and do not become tasks", () => {
  const input = [
    "- [ ] visible",
    "```md",
    "- [x] hidden",
    "```",
  ].join("\n");

  assert.deepEqual(parseMarkdown(input), [
    { type: "task", checked: false, text: "visible" },
    { type: "code", language: "md", text: "- [x] hidden\n" },
  ]);
});

test("task parsing preserves parser metadata contracts and line-ending normalization", () => {
  const lf = "- [ ] Read [[Guide]] #jp-planner";
  const expected = {
    ast: [
      { type: "task", checked: false, text: "Read [[Guide]] #jp-planner" },
      { type: "wikilink", target: "Guide" },
    ],
    tags: ["jp-planner"],
    links: ["Guide"],
    codeBlocks: [],
    tokens: ["-", "read", "guide", "jp-planner"],
  };

  assert.deepEqual(parseDocument(lf), expected);
  assert.deepEqual(parseDocument(lf.replaceAll("\n", "\r\n")), expected);
  assert.deepEqual(parseDocument(lf.replaceAll("\n", "\r")), expected);
});
