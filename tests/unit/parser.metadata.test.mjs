import assert from "node:assert/strict";
import test from "node:test";
import {
  extractCodeBlocks,
  extractTags,
  parseDocument,
  parseMarkdown,
  parseWikiLinks,
  tokenize,
} from "../../core/parser/index.js";

const emptyDocument = {
  ast: [],
  tags: [],
  links: [],
  codeBlocks: [],
  tokens: [],
};

test("parser helpers return explicit empty results for null-like values", () => {
  for (const value of [undefined, null, false, 0, ""]) {
    assert.deepEqual(parseDocument(value), emptyDocument);
  }
});

test("parser helpers coerce a representative non-string value without crashing", () => {
  assert.deepEqual(parseMarkdown(42), [{ type: "paragraph", text: "42" }]);
  assert.deepEqual(tokenize(42), ["42"]);
  assert.deepEqual(extractTags(42), []);
  assert.deepEqual(parseWikiLinks(42), []);
  assert.deepEqual(extractCodeBlocks(42), []);
});

test("parseDocument returns structurally identical output for the same input", () => {
  const input = "# Heading\n#Alpha [[First]]\n\`\`\`JS\nconst searchable_code = true;\n\`\`\`";

  assert.deepEqual(parseDocument(input), parseDocument(input));
});

test("extractTags normalizes, deduplicates, and preserves first-seen order", () => {
  assert.deepEqual(extractTags("#Beta #alpha #BETA #alpha-two"), ["beta", "alpha", "alpha-two"]);
});

test("parseWikiLinks trims, deduplicates, and preserves first-seen order", () => {
  assert.deepEqual(parseWikiLinks("[[ First ]] [[Second]] [[First]]"), ["First", "Second"]);
});

test("extractTags excludes apparent tags inside a closed fenced code block", () => {
  const input = "#outside\n\`\`\`JS\n#inside [[Hidden]]\n\`\`\`\n#after";

  assert.deepEqual(extractTags(input), ["outside", "after"]);
});

test("parseWikiLinks excludes apparent links inside a closed fenced code block", () => {
  const input = "[[Visible]]\n\`\`\`JS\n#inside [[Hidden]]\n\`\`\`\n[[After]]";

  assert.deepEqual(parseWikiLinks(input), ["Visible", "After"]);
});

test("parseMarkdown represents fenced code once without delimiter or body paragraphs", () => {
  const input = "Before\n\`\`\`js\nconst value = 1;\n\`\`\`\nAfter";

  assert.deepEqual(parseMarkdown(input), [
    { type: "paragraph", text: "Before" },
    { type: "paragraph", text: "After" },
    { type: "code", language: "js", text: "const value = 1;\n" },
  ]);
});

test("an unclosed fence is deterministic and excludes apparent metadata through end of input", () => {
  const input = "#outside\n\`\`\`TXT\n#inside [[Hidden]]\nconst searchable_unclosed = true;";
  const expected = {
    ast: [
      { type: "paragraph", text: "#outside" },
      {
        type: "code",
        language: "txt",
        text: "#inside [[Hidden]]\nconst searchable_unclosed = true;",
      },
    ],
    tags: ["outside"],
    links: [],
    codeBlocks: [
      {
        language: "txt",
        code: "#inside [[Hidden]]\nconst searchable_unclosed = true;",
      },
    ],
    tokens: ["outside", "txt", "inside", "hidden", "const", "searchable_unclosed", "true"],
  };

  assert.deepEqual(parseDocument(input), expected);
  assert.deepEqual(parseDocument(input), expected);
});

test("extractCodeBlocks handles defaults, normalized languages, empty blocks, and multiple fences", () => {
  const input = [
    "\`\`\`JS",
    "const one = 1;",
    "\`\`\`",
    "\`\`\`",
    "\`\`\`",
    "\`\`\`Ts_Lang",
    "let two;",
    "\`\`\`",
  ].join("\n");

  assert.deepEqual(extractCodeBlocks(input), [
    { language: "js", code: "const one = 1;\n" },
    { language: "txt", code: "" },
    { language: "ts_lang", code: "let two;\n" },
  ]);
});

test("parseMarkdown preserves heading levels and ordinary paragraphs", () => {
  assert.deepEqual(parseMarkdown("# One\n###### Six\n####### Seven\nordinary"), [
    { type: "heading", level: 1, text: "One" },
    { type: "heading", level: 6, text: "Six" },
    { type: "paragraph", text: "####### Seven" },
    { type: "paragraph", text: "ordinary" },
  ]);
});

test("metadata immediately before and after fences preserves first-seen order", () => {
  const input = [
    "#first [[First]]",
    "\`\`\`txt",
    "#hidden [[Hidden]]",
    "\`\`\`",
    "#second #first [[Second]] [[First]]",
  ].join("\n");

  assert.deepEqual(extractTags(input), ["first", "second"]);
  assert.deepEqual(parseWikiLinks(input), ["First", "Second"]);
});

test("LF and CRLF inputs produce structurally identical parser output", () => {
  const lf = "# Heading\n\`\`\`JS\nconst searchable_code = true;\n\`\`\`\n#after [[Visible]]";
  const crlf = lf.replaceAll("\n", "\r\n");

  assert.deepEqual(parseDocument(crlf), parseDocument(lf));
});

test("parseDocument aggregate fields stay consistent with parser helpers", () => {
  const input = "# Heading\n#outside [[Visible]]\n\`\`\`js\n#hidden [[Hidden]]\n\`\`\`";
  const parsed = parseDocument(input);

  assert.deepEqual(parsed.ast, parseMarkdown(input));
  assert.deepEqual(parsed.tags, extractTags(input));
  assert.deepEqual(parsed.links, parseWikiLinks(input));
  assert.deepEqual(parsed.codeBlocks, extractCodeBlocks(input));
  assert.deepEqual(parsed.tokens, tokenize(input));
});

test("tokenize preserves searchable code content in closed and unclosed fences", () => {
  const input = [
    "\`\`\`js",
    "const searchable_closed = true;",
    "\`\`\`",
    "\`\`\`txt",
    "searchable_unclosed",
  ].join("\n");
  const tokens = tokenize(input);

  assert.ok(tokens.includes("searchable_closed"));
  assert.ok(tokens.includes("searchable_unclosed"));
});
