import assert from "node:assert/strict";
import test from "node:test";
import { performance } from "node:perf_hooks";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { compileLearningItem } from "../../core/cardCompiler.js";
import { schedule } from "../../core/schedulerAdapter.js";
import { createAutosave } from "../../core/autosave.js";
import { parseDocument } from "../../core/parser/index.js";
import { createNoteBoardSections } from "../../ui/notePresentation.js";
import { createListView } from "../../ui/list.js";

// Budget constraints matching docs/PERFORMANCE_BUDGET.md and Epic #13
const PERFORMANCE_BUDGET = Object.freeze({
  maxMediumSearchQueryMedianMs: 20, // docs/PERFORMANCE_BUDGET.md: < 20 ms median on representative medium dataset
  maxMediumSearchQueryP95Ms: 50,
  maxLargeSearchQueryMedianMs: 50, // Epic #13 reference dataset common query target
  maxLargeSearchQueryP95Ms: 250, // 10k stress dataset upper bound across constrained CI environments
  maxMedium1kIndexMs: 100,
  maxLarge10kIndexMs: 500, // docs/PERFORMANCE_BUDGET.md indexing target
  maxAutosaveFlushExecutionMs: 50,
  max1kCardCompileMs: 100,
  max2kScheduleComputeMs: 50,
  max100ParserMs: 50,
  max10kVirtualWindowComputeMs: 100,
  maxKanjiStrokeGuideLoadMs: 50,
});

/**
 * Instantiates the actual production Search Worker (core/search.worker.js)
 * within an isolated VM context adhering to the Web Worker DedicatedWorkerGlobalScope protocol.
 * This directly executes production indexing, query scoring, tokenization, and cleanup algorithms.
 */
function createProductionSearchWorker() {
  const workerCode = readFileSync(new URL("../../core/search.worker.js", import.meta.url), "utf8");
  let onmessageHandler = null;
  const pendingRequests = new Map();

  const selfMock = {
    set onmessage(fn) {
      onmessageHandler = fn;
    },
    get onmessage() {
      return onmessageHandler;
    },
    postMessage(data) {
      const resolver = pendingRequests.get(data.id);
      if (resolver) {
        pendingRequests.delete(data.id);
        resolver(data);
      }
    },
  };

  const context = vm.createContext({
    self: selfMock,
    console,
    Date,
    Math,
    Map,
    Set,
    Array,
    String,
    Boolean,
    Object,
  });

  vm.runInContext(workerCode, context);

  let sequence = 0;
  function send(type, payload) {
    return new Promise((resolve, reject) => {
      const id = ++sequence;
      pendingRequests.set(id, (response) => {
        if (response.ok) {
          resolve(response.result);
        } else {
          reject(new Error(response.error || "Worker message failed"));
        }
      });
      selfMock.onmessage({ data: { id, type, payload } });
    });
  }

  return {
    rebuild: (notes) => send("rebuild", { notes }),
    upsert: (note) => send("upsert", { note }),
    remove: (id) => send("remove", { id }),
    query: (query) => send("query", { query }),
    inspectState: () => ({
      notesCount: vm.runInContext("notesById.size", context),
      tokenCount: vm.runInContext("tokenIndex.size", context),
      noteTokensCount: vm.runInContext("noteTokens.size", context),
    }),
  };
}

function generateSyntheticNotes(count) {
  const notes = [];
  for (let i = 0; i < count; i++) {
    notes.push({
      id: `note-${i}`,
      title: `Japanese grammar pattern ${i % 50} vocabulary item ${i % 20}`,
      content: `Contextual notes on particle usage and kanji stroke order for lesson ${i}. Tags: review, daily. [[reference-${i % 100}]]`,
      tags: ["japanese", `grammar-${i % 10}`, `n${(i % 5) + 1}`],
      links: [`reference-${i % 100}`],
      pinned: i % 25 === 0,
      archived: i % 100 === 0,
      updatedAt: new Date(Date.now() - i * 1000).toISOString(),
    });
  }
  return notes;
}

test("production search worker indexing and query latency satisfy performance budget tripwires across 1k and 10k datasets", async () => {
  const worker = createProductionSearchWorker();

  const queries = [
    "grammar-1",
    "particle",
    "kanji",
    "lesson 42",
    "vocabulary 5",
    "tag:n1",
    "is:pinned",
    "nonexistent",
  ];

  // 1. Medium dataset (1,000 notes - representative medium baseline)
  const dataset1k = generateSyntheticNotes(1000);
  const t0 = performance.now();
  await worker.rebuild(dataset1k);
  const index1kDuration = performance.now() - t0;
  assert.ok(
    index1kDuration < PERFORMANCE_BUDGET.maxMedium1kIndexMs,
    `Production 1k note indexing took ${index1kDuration.toFixed(2)}ms (budget: < ${PERFORMANCE_BUDGET.maxMedium1kIndexMs}ms)`
  );

  // Warm-up query pass
  for (const q of queries) {
    await worker.query(q);
  }

  const query1kDurations = [];
  for (let i = 0; i < 50; i++) {
    const q = queries[i % queries.length];
    const q0 = performance.now();
    const results = await worker.query(q);
    query1kDurations.push(performance.now() - q0);
    assert.ok(Array.isArray(results));
  }

  query1kDurations.sort((a, b) => a - b);
  const median1k = query1kDurations[Math.floor(query1kDurations.length * 0.5)];
  const p95_1k = query1kDurations[Math.floor(query1kDurations.length * 0.95)];

  assert.ok(
    median1k < PERFORMANCE_BUDGET.maxMediumSearchQueryMedianMs,
    `1k medium dataset median query latency ${median1k.toFixed(3)}ms exceeded budget (< ${PERFORMANCE_BUDGET.maxMediumSearchQueryMedianMs}ms)`
  );
  assert.ok(
    p95_1k < PERFORMANCE_BUDGET.maxMediumSearchQueryP95Ms,
    `1k medium dataset p95 query latency ${p95_1k.toFixed(3)}ms exceeded budget (< ${PERFORMANCE_BUDGET.maxMediumSearchQueryP95Ms}ms)`
  );

  // 2. Large stress dataset (10,000 notes - Epic #13 reference dataset)
  const dataset10k = generateSyntheticNotes(10000);
  const t1 = performance.now();
  await worker.rebuild(dataset10k);
  const index10kDuration = performance.now() - t1;

  assert.ok(
    index10kDuration < PERFORMANCE_BUDGET.maxLarge10kIndexMs,
    `Production 10k note indexing took ${index10kDuration.toFixed(2)}ms (budget: < ${PERFORMANCE_BUDGET.maxLarge10kIndexMs}ms)`
  );

  // Warm-up query pass on 10k index
  for (const q of queries) {
    await worker.query(q);
  }

  const query10kDurations = [];
  for (let i = 0; i < 50; i++) {
    const q = queries[i % queries.length];
    const q0 = performance.now();
    const results = await worker.query(q);
    query10kDurations.push(performance.now() - q0);
    assert.ok(Array.isArray(results));
  }

  query10kDurations.sort((a, b) => a - b);
  const median10k = query10kDurations[Math.floor(query10kDurations.length * 0.5)];
  const p95_10k = query10kDurations[Math.floor(query10kDurations.length * 0.95)];

  assert.ok(
    median10k < PERFORMANCE_BUDGET.maxLargeSearchQueryMedianMs,
    `10k large dataset median query latency ${median10k.toFixed(3)}ms exceeded budget (< ${PERFORMANCE_BUDGET.maxLargeSearchQueryMedianMs}ms)`
  );
  assert.ok(
    p95_10k < PERFORMANCE_BUDGET.maxLargeSearchQueryP95Ms,
    `10k large dataset p95 query latency ${p95_10k.toFixed(3)}ms exceeded budget (< ${PERFORMANCE_BUDGET.maxLargeSearchQueryP95Ms}ms)`
  );

  // 3. Production Search Worker: Token memory cleanup invariant upon note deletion
  for (let i = 0; i < 10000; i++) {
    await worker.remove(`note-${i}`);
  }

  const queryAfterDeletion = await worker.query("grammar-1");
  assert.equal(queryAfterDeletion.length, 0);

  const stateAfterDeletion = worker.inspectState();
  assert.equal(stateAfterDeletion.notesCount, 0, "All notes must be removed from production notesById Map");
  assert.equal(stateAfterDeletion.noteTokensCount, 0, "All note token sets must be removed from noteTokens Map");
  assert.equal(stateAfterDeletion.tokenCount, 0, "All tokens must be purged from production tokenIndex Map");
});

test("Japanese V2 card compiler and scheduler adapter throughput meet release budget", () => {
  // 1. Compile 1,000 items (2,000 cards) via production compileLearningItem
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

  // 2. Schedule 2,000 cards via production schedule adapter
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
    const { nextState, log } = schedule(state, { grade: "good", reviewedAt: now }, now);
    assert.equal(nextState.state, "review");
    assert.equal(log.stateBefore, "new");
    assert.equal(log.stateAfter, "review");
  }
  const scheduleDuration = performance.now() - t1;
  assert.ok(
    scheduleDuration < PERFORMANCE_BUDGET.max2kScheduleComputeMs,
    `Scheduling 2,000 cards took ${scheduleDuration.toFixed(2)}ms (budget: < ${PERFORMANCE_BUDGET.max2kScheduleComputeMs}ms)`
  );
});

test("deterministic autosave flush execution budget settles within latency tripwire", async () => {
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
    autosaveDuration < PERFORMANCE_BUDGET.maxAutosaveFlushExecutionMs,
    `20 autosave flush cycles took ${autosaveDuration.toFixed(2)}ms (budget: < ${PERFORMANCE_BUDGET.maxAutosaveFlushExecutionMs}ms)`
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

function createMockDomContainer() {
  const listeners = new Map();
  function createMockElement(tag) {
    const el = {
      tagName: tag.toUpperCase(),
      className: "",
      textContent: "",
      style: {},
      dataset: {},
      attributes: new Map(),
      children: [],
      setAttribute(k, v) { this.attributes.set(k, v); },
      removeAttribute(k) { this.attributes.delete(k); },
      getAttribute(k) { return this.attributes.get(k); },
      classList: {
        toggle(cls, force) {
          if (force) el.className += ` ${cls}`;
          else el.className = el.className.replace(cls, "");
        },
        add(cls) { el.className += ` ${cls}`; },
        remove(cls) { el.className = el.className.replace(cls, ""); },
        contains(cls) { return el.className.includes(cls); },
      },
      append(...nodes) { this.children.push(...nodes); },
      appendChild(node) { this.children.push(node); return node; },
      replaceChildren(...nodes) { this.children = [...nodes]; },
      querySelector(sel) {
        const cls = sel.replace(/^\./, "");
        function find(el) {
          if (el.classList?.contains?.(cls) || el.className?.includes?.(cls)) return el;
          for (const child of el.children) {
            const match = find(child);
            if (match) return match;
          }
          return null;
        }
        for (const child of this.children) {
          const match = find(child);
          if (match) return match;
        }
        return null;
      },
      querySelectorAll(sel) {
        const cls = sel.replace(/^\./, "");
        const results = [];
        function collect(el) {
          if (el.classList?.contains?.(cls) || el.className?.includes?.(cls)) results.push(el);
          for (const child of el.children) {
            collect(child);
          }
        }
        for (const child of this.children) {
          collect(child);
        }
        return results;
      },
      closest() { return null; },
      addEventListener(event, fn) {
        listeners.set(event, fn);
      },
      removeEventListener(event) {
        listeners.delete(event);
      },
      remove() {},
      clientWidth: 1000,
      clientHeight: 720,
      scrollTop: 0,
      scrollHeight: 560000,
      scrollWidth: 1000,
    };
    return el;
  }

  globalThis.document = {
    createElement(tag) { return createMockElement(tag); },
    createDocumentFragment() {
      return createMockElement("fragment");
    },
  };

  const container = createMockElement("div");
  return { container, listeners };
}

test("production createListView large board virtualization settles within performance budget across 10k dataset", () => {
  const notes10k = generateSyntheticNotes(10000);
  const notesById = new Map(notes10k.map((n) => [n.id, n]));
  const orderedIds = notes10k.map((n) => n.id);

  // 1. Board section grouping on 10k items
  const t0 = performance.now();
  const sections = createNoteBoardSections({ notesById, orderedIds, query: "" });
  const sectionDuration = performance.now() - t0;
  assert.ok(sections.length > 0);
  assert.ok(
    sectionDuration < PERFORMANCE_BUDGET.max10kVirtualWindowComputeMs,
    `10k note section grouping took ${sectionDuration.toFixed(2)}ms (budget: < ${PERFORMANCE_BUDGET.max10kVirtualWindowComputeMs}ms)`
  );

  // 2. Production createListView rendering path benchmark on 10,000 items
  const { container, listeners } = createMockDomContainer();
  const view = createListView({
    container,
    onSelect() {},
    formatDate: () => "Aug 12",
  });

  const t1 = performance.now();
  // Initial render in Grid View
  view.render({
    notesById,
    orderedIds,
    activeId: null,
    query: "",
    viewMode: "grid",
  });

  // Verify production virtualization activated
  assert.equal(container.dataset.virtualized, "true");
  assert.equal(container.dataset.viewMode, "grid");

  // Benchmark 50 scroll-triggered production window re-renders
  const scrollListener = listeners.get("scroll");
  assert.ok(typeof scrollListener === "function", "scroll listener should be registered by createListView");

  const rowHeight = 168;
  const cols = 3;
  const totalRows = Math.ceil(orderedIds.length / cols);

  for (let step = 0; step < 50; step++) {
    container.scrollTop = (step * 300) % (totalRows * rowHeight);
    scrollListener();
  }

  const productionRenderDuration = performance.now() - t1;
  assert.ok(
    productionRenderDuration < PERFORMANCE_BUDGET.max10kVirtualWindowComputeMs,
    `50 production createListView virtualization cycles took ${productionRenderDuration.toFixed(2)}ms (budget: < ${PERFORMANCE_BUDGET.max10kVirtualWindowComputeMs}ms)`
  );
});

test("lazy Kanji stroke guide dictionary asset dynamic import resolves within budget", async () => {
  const t0 = performance.now();
  const strokeGuide = await import("../../core/kanjiStrokeGuide.js");
  const loadDuration = performance.now() - t0;

  assert.ok(typeof strokeGuide.renderStrokeGuidance === "function");
  assert.ok(typeof strokeGuide.getKanjiStrokeMetadata === "function");
  assert.ok(typeof strokeGuide.getKanjiStrokeDictionary === "function");

  assert.ok(
    loadDuration < PERFORMANCE_BUDGET.maxKanjiStrokeGuideLoadMs,
    `Dynamic import of kanjiStrokeGuide took ${loadDuration.toFixed(2)}ms (budget: < ${PERFORMANCE_BUDGET.maxKanjiStrokeGuideLoadMs}ms)`
  );

  // 10,000 dictionary lookups
  const t1 = performance.now();
  for (let i = 0; i < 10000; i++) {
    const meta = strokeGuide.getKanjiStrokeMetadata("学");
    assert.equal(meta.strokes, 8);
  }
  const lookupDuration = performance.now() - t1;
  assert.ok(
    lookupDuration < PERFORMANCE_BUDGET.maxKanjiStrokeGuideLoadMs,
    `10k dictionary lookups took ${lookupDuration.toFixed(2)}ms (budget: < ${PERFORMANCE_BUDGET.maxKanjiStrokeGuideLoadMs}ms)`
  );
});
