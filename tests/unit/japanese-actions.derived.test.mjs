import assert from "node:assert/strict";
import test from "node:test";
import { createCommandStack } from "../../core/commandStack.js";
import { createJapaneseActions } from "../../core/japaneseActions.js";
import { createJapaneseAppState } from "../../core/japaneseState.js";

const NOW = "2026-07-31T12:00:00.000Z";

function note(seed) {
  return {
    id: "created",
    title: seed.title,
    content: seed.content,
    blocks: [],
    tags: [],
    createdAt: NOW,
    updatedAt: NOW,
    pinned: false,
    archived: false,
    links: [],
    ast: [],
    checksum: "checksum",
    searchBlob: "",
    version: 1,
  };
}

test("derived index failure preserves durable create and records bounded degradation", async () => {
  let state = {
    ...createJapaneseAppState({
      notes: [],
      reviews: [],
      nowIso: NOW,
      localDate: "2026-07-31",
      isoWeek: "2026-W31",
    }),
    notes: [],
  };
  const events = [];
  const actions = createJapaneseActions({
    getState: () => state,
    setState(patch) {
      const next = typeof patch === "function" ? patch(state) : patch;
      state = { ...state, ...next };
      events.push("state");
      return state;
    },
    commandStack: createCommandStack(),
    persist: {
      async createPair() {
        events.push("persist");
      },
      async deleteWithReview() {},
      async restorePair() {},
      async putReview() {},
      async putNote() {},
      async deleteNote() {},
    },
    derived: {
      async upsert() {
        events.push("derived");
        throw new Error("worker unavailable");
      },
      async remove() {},
    },
    history: {
      record() {
        events.push("history");
      },
    },
    createNote: note,
  });

  await actions.createJapaneseNote("vocabulary", {}, {
    nowIso: NOW,
    localDate: "2026-07-31",
    isoWeek: "2026-W31",
  });

  assert.deepEqual(events, ["persist", "state", "derived", "state", "history"]);
  assert.deepEqual(state.notes.map((item) => item.id), ["created"]);
  assert.deepEqual(state.studyReviews.map((item) => item.noteId), ["created"]);
  assert.deepEqual(state.studyStatus, [
    { code: "derived-index-unavailable", count: 1 },
  ]);
});
