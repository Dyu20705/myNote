import { normalizeNote } from "../../../core/model.js";
import { parseDocument } from "../../../core/parser/index.js";
import { applyNotePatch, createNotePatch, invertNotePatch } from "../../../core/notePatch.js";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function equalJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function testParseDeterministic() {
  const input = "# Title\n\nhello [[linux]] #kernel\n\n```js\nconsole.log('x')\n```";
  const first = parseDocument(input);
  const second = parseDocument(input);
  assert(equalJson(first, second), "parseDocument must be deterministic");
}

function testNotePatchReversible() {
  const previous = normalizeNote({
    id: "n1",
    title: "Linux",
    content: "hello #kernel [[epoll]]",
    version: 2,
  });
  const next = normalizeNote({
    ...previous,
    content: "hello #network [[epoll]] [[kqueue]]",
    version: previous.version + 1,
  });

  const patch = createNotePatch(previous, next);
  const reverted = applyNotePatch(next, invertNotePatch(patch));
  assert(equalJson(reverted, previous), "inverted patch must restore exact state");
}

function testPatchDeterministic() {
  const a = normalizeNote({ id: "n2", title: "A", content: "one #x", version: 1 });
  const b = normalizeNote({ ...a, content: "two #x #y", version: 2 });

  const first = createNotePatch(a, b);
  const second = createNotePatch(a, b);
  assert(equalJson(first, second), "patch generation must be deterministic");
}

export function runParserInvariantTests() {
  testParseDeterministic();
  testNotePatchReversible();
  testPatchDeterministic();
  return "Parser invariant tests passed";
}
