import test from "node:test";
import assert from "node:assert/strict";
import {
  wrapSelection,
  insertBold,
  insertItalic,
  insertStrikethrough,
  insertInlineCode,
  insertLink,
  cycleHeading,
  insertTaskItem,
} from "../../core/markdownActions.js";

test("Markdown Actions — wrapSelection", async (t) => {
  await t.test("wraps selected text with prefix and suffix", () => {
    const text = "Hello world!";
    const result = wrapSelection(text, 6, 11, "**");
    assert.equal(result.value, "Hello **world**!");
    assert.equal(result.selectionStart, 8);
    assert.equal(result.selectionEnd, 13);
  });

  await t.test("unwraps text if already wrapped", () => {
    const text = "Hello **world**!";
    const result = wrapSelection(text, 8, 13, "**");
    assert.equal(result.value, "Hello world!");
    assert.equal(result.selectionStart, 6);
    assert.equal(result.selectionEnd, 11);
  });

  await t.test("inserts empty wrapper when selection is collapsed", () => {
    const text = "Hello world";
    const result = wrapSelection(text, 5, 5, "**");
    assert.equal(result.value, "Hello**** world");
    assert.equal(result.selectionStart, 7);
    assert.equal(result.selectionEnd, 7);
  });

  await t.test("handles asymmetric prefix and suffix", () => {
    const text = "Hello world";
    const result = wrapSelection(text, 6, 11, "[", "](url)");
    assert.equal(result.value, "Hello [world](url)");
  });

  await t.test("handles multiline and unicode text safely", () => {
    const text = "日本語\nテスト";
    const result = wrapSelection(text, 0, 3, "**");
    assert.equal(result.value, "**日本語**\nテスト");
  });
});

test("Markdown Actions — Convenience Wrappers", async (t) => {
  await t.test("insertBold wraps with double asterisks", () => {
    const res = insertBold("note text", 0, 4);
    assert.equal(res.value, "**note** text");
  });

  await t.test("insertItalic wraps with single asterisk", () => {
    const res = insertItalic("note text", 0, 4);
    assert.equal(res.value, "*note* text");
  });

  await t.test("insertStrikethrough wraps with double tildes", () => {
    const res = insertStrikethrough("note text", 0, 4);
    assert.equal(res.value, "~~note~~ text");
  });

  await t.test("insertInlineCode wraps with backticks", () => {
    const res = insertInlineCode("const x = 1", 0, 5);
    assert.equal(res.value, "`const` x = 1");
  });

  await t.test("insertLink creates markdown link syntax", () => {
    const res = insertLink("click here for info", 6, 10);
    assert.equal(res.value, "click [here](url) for info");
  });

  await t.test("insertLink with empty selection inserts placeholder", () => {
    const res = insertLink("", 0, 0);
    assert.equal(res.value, "[title](url)");
    assert.equal(res.selectionStart, 1);
    assert.equal(res.selectionEnd, 6);
  });
});

test("Markdown Actions — cycleHeading", async (t) => {
  await t.test("cycles from plain text to H1", () => {
    const res = cycleHeading("My Title\nSecond line", 3);
    assert.equal(res.value, "# My Title\nSecond line");
    assert.equal(res.selectionStart, 5);
  });

  await t.test("cycles from H1 to H2", () => {
    const res = cycleHeading("# My Title\nSecond line", 5);
    assert.equal(res.value, "## My Title\nSecond line");
  });

  await t.test("cycles from H2 to H3", () => {
    const res = cycleHeading("## My Title\nSecond line", 5);
    assert.equal(res.value, "### My Title\nSecond line");
  });

  await t.test("cycles from H3 back to plain text", () => {
    const res = cycleHeading("### My Title\nSecond line", 5);
    assert.equal(res.value, "My Title\nSecond line");
  });

  await t.test("operates on second line when cursor is on second line", () => {
    const res = cycleHeading("Line 1\nLine 2", 9);
    assert.equal(res.value, "Line 1\n# Line 2");
  });
});

test("Markdown Actions — insertTaskItem", async (t) => {
  await t.test("adds task prefix to plain line", () => {
    const res = insertTaskItem("Buy groceries\nWalk dog", 2);
    assert.equal(res.value, "- [ ] Buy groceries\nWalk dog");
  });

  await t.test("removes task prefix if already present", () => {
    const res = insertTaskItem("- [ ] Buy groceries\nWalk dog", 8);
    assert.equal(res.value, "Buy groceries\nWalk dog");
  });

  await t.test("removes completed task prefix if present", () => {
    const res = insertTaskItem("- [x] Done task", 4);
    assert.equal(res.value, "Done task");
  });
});
