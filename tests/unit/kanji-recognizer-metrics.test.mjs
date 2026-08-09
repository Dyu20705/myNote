import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import test from "node:test";

import {
  getKanjiRecognizerFixtures,
  getKanjiRecognizerMetrics,
  recognizeKanji,
} from "../../core/kanjiRecognizer.js";

test("Kanji recognizer emits reproducible bounded measurement evidence", (context) => {
  const fixtures = getKanjiRecognizerFixtures();
  let topOneCorrect = 0;
  for (const fixture of fixtures) {
    if (recognizeKanji(fixture.strokes)[0]?.character === fixture.character) {
      topOneCorrect += 1;
    }
  }

  const durations = [];
  for (let iteration = 0; iteration < 200; iteration += 1) {
    const fixture = fixtures[iteration % fixtures.length];
    const started = performance.now();
    recognizeKanji(fixture.strokes);
    durations.push(performance.now() - started);
  }
  durations.sort((left, right) => left - right);
  const percentile = (value) => durations[Math.min(
    durations.length - 1,
    Math.floor(durations.length * value),
  )];
  const metrics = getKanjiRecognizerMetrics();
  const report = {
    supportedFixtures: fixtures.length,
    canonicalTopOneCorrect: topOneCorrect,
    canonicalTopOneAccuracy: topOneCorrect / fixtures.length,
    p50Milliseconds: Number(percentile(0.5).toFixed(3)),
    p95Milliseconds: Number(percentile(0.95).toFixed(3)),
    maxMilliseconds: Number(durations.at(-1).toFixed(3)),
    templateBytes: metrics.templateBytes,
    templateCount: metrics.templateCount,
    networkRequests: metrics.networkRequests,
  };

  context.diagnostic(`KANJI_RECOGNIZER_METRICS ${JSON.stringify(report)}`);
  assert.equal(report.canonicalTopOneCorrect, 8);
  assert.equal(report.canonicalTopOneAccuracy, 1);
  assert.ok(report.p95Milliseconds <= 50);
  assert.ok(report.templateBytes <= 64 * 1024);
  assert.equal(report.templateCount, 8);
  assert.equal(report.networkRequests, 0);
});
