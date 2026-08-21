import assert from "node:assert/strict";
import test from "node:test";
import { performance } from "node:perf_hooks";
import { compileLearningItem } from "../../core/cardCompiler.js";
import { schedule } from "../../core/schedulerAdapter.js";
import { createAutosave } from "../../core/autosave.js";
import { parseDocument } from "../../core/parser/index.js";

// Budget constraints matching docs/PERFORMANCE_BUDGET.md
const PERFORMANCE_BUDGET = Object.freeze({
  maxSearchQueryMedianMs: 20,
  maxSearchQueryP95Ms: 50,
  maxSearch10kIndexMs: 500,
  maxAutosaveMs: 50,
  max1kCardCompileMs: 100,
  max2kScheduleComputeMs: 50,
  max100ParserMs: 50,
});

// Search Worker Indexing and Query Simulation
function createSearchIndex() {
  const notesById = new Map();
  const tokenIndex = new Map();
  const noteTokens = new Map();

  function tokenize(value) {
    return String(value || "")
      .toLowerCase()
      .split(/[^a-z0-9_-]+/)
      .filter(Boolean);
  }

  function addToken(token, noteId) {
    if (!tokenIndex.has(token)) {
      tokenIndex.set(token, new Set());
    }
    tokenIndex.get(token).add(noteId);
  }

  function removeToken(token, noteId) {
    const entry = tokenIndex.get(token);
    if (!entry) return;
    entry.delete(noteId);
    if (entry.size === 0) {
      tokenIndex.delete(token);
    }
  }

  function tokensForNote(note) {
    const textTokens = tokenize(`${note.title} ${note.content}`);
    const tagTokens = (note.tags || []).map((t) => `tag:${t}`);
    return new Set([...textTokens, ...tagTokens]);
  }

  function upsertNote(note) {
    const previousTokens = noteTokens.get(note.id);
    if (previousTokens) {
      for (const token of previousTokens) {
        removeToken(token, note.id);
      }
    }
    notesById.set(note.id, note);
    const nextTokens = tokensForNote(note);
    noteTokens.set(note.id, nextTokens);
    for (const token of nextTokens) {
      addToken(token, note.id);
    }
  }

  function deleteNote(id) {
    const previousTokens = noteTokens.get(id);
    if (previousTokens) {
      for (const token of previousTokens) {
        removeToken(token, id);
      }
      noteTokens.delete(id);
    }
    notesById.delete(id);
  }

  function search(query) {
    const queryTokens = tokenize(query);
    if (queryTokens.length === 0) return [];
    let candidateIds = null;
    for (const token of queryTokens) {
      const ids = tokenIndex.get(token) || new Set();
      if (candidateIds === null) {
        candidateIds = new Set(ids);
      } else {
        for (const id of candidateIds) {
          if (!ids.has(id)) candidateIds.delete(id);
        }
      }
    }
    return Array.from(candidateIds || []).map((id) => notesById.get(id));
  }

  return {
    notesById,
    tokenIndex,
    noteTokens,
    upsertNote,
    deleteNote,
    search,
  };
}

function generateSyntheticNotes(count) {
  const notes = [];
  for (let i = 0; i < count; i++) {
    notes.push({
      id: `note-${i}`,
      title: `Japanese grammar pattern ${i % 50} vocabulary item ${i % 20}`,
      content: `Contextual notes on particle usage and kanji stroke order for lesson ${i}. Tags: review, daily. [[reference-${i % 10}]]`,
      tags: ["japanese", "grammar", `n${(i % 5) + 1}`],
      updatedAt: new Date(Date.now() - i * 1000).toISOString(),
    });
  }
  return notes;
}

test("search index rebuild and query latency satisfy performance budget tripwires", () => {
  const index = createSearchIndex();
  const dataset10k = generateSyntheticNotes(10000);

  // 1. Index 10,000 notes
  const t0 = performance.now();
  for (const note of dataset10k) {
    index.upsertNote(note);
  }
  const indexDuration = performance.now() - t0;
  assert.ok(
    indexDuration < PERFORMANCE_BUDGET.maxSearch10kIndexMs,
    `10k note indexing took ${indexDuration.toFixed(2)}ms (budget: < ${PERFORMANCE_BUDGET.maxSearch10kIndexMs}ms)`
  );
  assert.equal(index.notesById.size, 10000);

  // 2. Query latency tripwire (50 query samples across multiple query types)
  const queries = [
    "grammar",
    "particle",
    "kanji",
    "lesson 42",
    "vocabulary 5",
    "tag:japanese",
    "tag:n1",
    "nonexistent",
  ];

  // Warm-up query
  index.search("warmup query");

  const queryDurations = [];
  for (let i = 0; i < 50; i++) {
    const q = queries[i % queries.length];
    const q0 = performance.now();
    const results = index.search(q);
    const qDuration = performance.now() - q0;
    queryDurations.push(qDuration);
    assert.ok(Array.isArray(results));
  }

  queryDurations.sort((a, b) => a - b);
  const median = queryDurations[Math.floor(queryDurations.length * 0.5)];
  const p95 = queryDurations[Math.floor(queryDurations.length * 0.95)];

  assert.ok(
    median < PERFORMANCE_BUDGET.maxSearchQueryMedianMs,
    `Median query latency ${median.toFixed(3)}ms exceeded budget (< ${PERFORMANCE_BUDGET.maxSearchQueryMedianMs}ms)`
  );
  assert.ok(
    p95 < PERFORMANCE_BUDGET.maxSearchQueryP95Ms,
    `p95 query latency ${p95.toFixed(3)}ms exceeded budget (< ${PERFORMANCE_BUDGET.maxSearchQueryP95Ms}ms)`
  );

  // 3. Token memory cleanup invariant
  const initialTokenCount = index.tokenIndex.size;
  assert.ok(initialTokenCount > 0);

  // Delete all notes
  for (let i = 0; i < 10000; i++) {
    index.deleteNote(`note-${i}`);
  }
  assert.equal(index.notesById.size, 0);
  assert.equal(index.noteTokens.size, 0);
  assert.equal(index.tokenIndex.size, 0, "All tokens must be purged from tokenIndex when notes are deleted");
});

test("Japanese V2 card compiler and scheduler adapter throughput meet release budget", () => {
  // 1. Compile 1,000 items (2,000 cards)
  const t0 = performance.now();
  const compiledCards = [];
  for (let i = 0; i < 1000; i++) {
    const item = {
      id: `item-${i}`,
      type: "vocabulary",
      content: { word: `単語${i}`, reading: `たんご${i}`, meaning: "word" },
      skills: ["recognition", "meaning"],
      sourceRefs: [{ type: "note", id: `note-${i}` }],
      status: "active",
    };
    const { cards } = compileLearningItem(item, []);
    compiledCards.push(...cards);
  }
  const compileDuration = performance.now() - t0;
  assert.equal(compiledCards.length, 2000);
  assert.ok(
    compileDuration < PERFORMANCE_BUDGET.max1kCardCompileMs,
    `Compiling 1,000 items took ${compileDuration.toFixed(2)}ms (budget: < ${PERFORMANCE_BUDGET.max1kCardCompileMs}ms)`
  );

  // 2. Schedule 2,000 cards
  const t1 = performance.now();
  const now = new Date().toISOString();
  for (const card of compiledCards) {
    const state = {
      cardId: card.id,
      state: "new",
      due: now,
      reps: 0,
      lapses: 0,
      elapsedDays: 0,
      scheduledDays: 0,
    };
    const { nextState } = schedule(state, { grade: "good", reviewedAt: now }, now);
    assert.equal(nextState.state, "review");
  }
  const scheduleDuration = performance.now() - t1;
  assert.ok(
    scheduleDuration < PERFORMANCE_BUDGET.max2kScheduleComputeMs,
    `Scheduling 2,000 cards took ${scheduleDuration.toFixed(2)}ms (budget: < ${PERFORMANCE_BUDGET.max2kScheduleComputeMs}ms)`
  );
});

test("autosave scheduling and flush settle within latency budget", async () => {
  let saveCount = 0;
  const mockScheduler = {
    setTimeout(cb) {
      cb();
      return 1;
    },
    clearTimeout() {},
    requestIdle(cb) {
      cb();
      return 2;
    },
    cancelIdle() {},
  };

  const autosave = createAutosave({
    delayMs: 10,
    async onSave() {
      saveCount += 1;
    },
    scheduler: mockScheduler,
  });

  const t0 = performance.now();
  for (let i = 0; i < 20; i++) {
    autosave.queue();
    await autosave.flush();
  }
  const autosaveDuration = performance.now() - t0;
  assert.equal(saveCount, 20);
  assert.ok(
    autosaveDuration < PERFORMANCE_BUDGET.maxAutosaveMs,
    `20 autosave cycles took ${autosaveDuration.toFixed(2)}ms (budget: < ${PERFORMANCE_BUDGET.maxAutosaveMs}ms)`
  );
});

test("markdown AST parser throughput meets bounded processing budget", () => {
  const sampleMarkdown = `
# Lesson Title: Japanese Grammar Mastery

Here is an introductory paragraph with #grammar #n3 tags and a [[reference-note]] link.

\`\`\`javascript
const greeting = "こんにちは";
console.log(greeting);
\`\`\`

- [x] Review vocabulary
- [ ] Practice kanji stroke order

## Subheading

Additional text with *emphasis* and **strong** formatting.
`;

  const t0 = performance.now();
  for (let i = 0; i < 100; i++) {
    const doc = parseDocument(sampleMarkdown);
    assert.equal(doc.tags.length, 2);
    assert.equal(doc.links.length, 1);
  }
  const parseDuration = performance.now() - t0;
  assert.ok(
    parseDuration < PERFORMANCE_BUDGET.max100ParserMs,
    `100 markdown parses took ${parseDuration.toFixed(2)}ms (budget: < ${PERFORMANCE_BUDGET.max100ParserMs}ms)`
  );
});
