import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import test from "node:test";

async function loadModule() {
  return import(new URL("../../core/kanjiRecognizer.js", import.meta.url));
}

test("recognizer identity and supported set are explicit and frozen", async () => {
  const {
    KANJI_RECOGNIZER_INFO,
    SUPPORTED_KANJI,
  } = await loadModule();

  assert.deepEqual(KANJI_RECOGNIZER_INFO, {
    engineId: "mynote-geometric-template",
    engineVersion: "1.0.0",
    datasetVersion: "mynote-kanji-mvp-1",
  });
  assert.deepEqual(SUPPORTED_KANJI, ["人", "入", "八", "大", "犬", "火", "木", "本"]);
  assert.equal(Object.isFrozen(KANJI_RECOGNIZER_INFO), true);
  assert.equal(Object.isFrozen(SUPPORTED_KANJI), true);
});

test("every canonical local fixture recognizes itself as top one", async () => {
  const {
    getKanjiRecognizerFixtures,
    recognizeKanji,
  } = await loadModule();
  const fixtures = getKanjiRecognizerFixtures();

  for (const fixture of fixtures) {
    const result = recognizeKanji(fixture.strokes);
    assert.ok(result.length > 0, `${fixture.character} must produce candidates`);
    assert.equal(result[0].character, fixture.character);
    assert.ok(result[0].score >= 0 && result[0].score <= 1);
  }
});

test("candidate order is deterministic, unique, and bounded to eight", async () => {
  const {
    getKanjiRecognizerFixtures,
    recognizeKanji,
  } = await loadModule();
  const strokes = getKanjiRecognizerFixtures().find((item) => item.character === "大").strokes;
  const first = recognizeKanji(strokes);
  const second = recognizeKanji(strokes);

  assert.deepEqual(first, second);
  assert.ok(first.length <= 8);
  assert.equal(new Set(first.map((candidate) => candidate.character)).size, first.length);
  assert.deepEqual(
    [...first].sort((left, right) => right.score - left.score || left.character.localeCompare(right.character, "ja")),
    first,
  );
});

test("visually related fixtures retain meaningful distractors", async () => {
  const {
    getKanjiRecognizerFixtures,
    recognizeKanji,
  } = await loadModule();
  const fixtures = getKanjiRecognizerFixtures();

  const person = recognizeKanji(fixtures.find((item) => item.character === "人").strokes);
  assert.equal(person[0].character, "人");
  assert.ok(person.slice(1).some((candidate) => ["入", "八"].includes(candidate.character)));

  const tree = recognizeKanji(fixtures.find((item) => item.character === "木").strokes);
  assert.equal(tree[0].character, "木");
  assert.ok(tree.slice(1).some((candidate) => candidate.character === "本"));
});

test("malformed, oversized, and unrelated strokes fail safely", async () => {
  const { recognizeKanji } = await loadModule();

  for (const strokes of [
    null,
    [],
    [[{ x: 0.5, y: 0.5 }]],
    [[{ x: -1, y: 0 }, { x: 1, y: 1 }]],
    Array.from({ length: 33 }, () => [{ x: 0, y: 0 }, { x: 1, y: 1 }]),
  ]) {
    assert.throws(() => recognizeKanji(strokes), {
      code: "KANJI_RECOGNITION_INPUT_INVALID",
      message: "KANJI_RECOGNITION_INPUT_INVALID",
    });
  }

  const scribble = [[
    { x: 0.1, y: 0.1 },
    { x: 0.9, y: 0.1 },
    { x: 0.1, y: 0.9 },
    { x: 0.9, y: 0.9 },
    { x: 0.1, y: 0.1 },
  ]];
  assert.deepEqual(recognizeKanji(scribble), []);
});

test("recognizer payload and canonical fixture latency stay bounded", async () => {
  const {
    getKanjiRecognizerFixtures,
    getKanjiRecognizerMetrics,
    recognizeKanji,
  } = await loadModule();

  const metrics = getKanjiRecognizerMetrics();
  assert.ok(metrics.templateBytes <= 64 * 1024);
  assert.equal(metrics.templateCount, 8);
  assert.equal(metrics.networkRequests, 0);

  const fixture = getKanjiRecognizerFixtures()[0].strokes;
  const durations = [];
  for (let index = 0; index < 25; index += 1) {
    const started = performance.now();
    recognizeKanji(fixture);
    durations.push(performance.now() - started);
  }
  durations.sort((left, right) => left - right);
  const p95 = durations[Math.floor(durations.length * 0.95)];
  assert.ok(p95 <= 50, `recognition p95 ${p95.toFixed(2)} ms exceeds 50 ms`);
});
