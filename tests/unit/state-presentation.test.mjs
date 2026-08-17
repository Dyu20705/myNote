import test from "node:test";
import assert from "node:assert/strict";
import {
  presentApplicationRecoveryState,
  presentBoardState,
  presentDerivedState,
  presentDrawingState,
  presentJapaneseReviewState,
  presentNoteState,
} from "../../ui/statePresentation.js";

test("board state distinguishes empty from no-match", () => {
  assert.equal(presentBoardState({ total: 0, visible: 0, japanese: false }).kind, "empty");
  assert.equal(presentBoardState({ total: 3, visible: 0, japanese: false }).kind, "no-match");
  assert.equal(presentBoardState({ total: 0, visible: 0, japanese: true }).actionId, "create-japanese-note");
});

test("note state distinguishes edit, create, delete, and quiet success", () => {
  assert.deepEqual(
    presentNoteState({ dirty: false, phase: "idle", failureKind: "" }),
    { kind: "saved", tone: "success", message: "Saved", announce: "off", persistent: false, actionId: null },
  );
  assert.equal(presentNoteState({ dirty: true, phase: "idle", failureKind: "edit" }).actionId, "retry-save");
  assert.match(presentNoteState({ dirty: false, phase: "idle", failureKind: "create" }).message, /No note was added/);
  assert.match(presentNoteState({ dirty: false, phase: "idle", failureKind: "delete" }).message, /note is unchanged/);
});

test("derived degradation states that canonical data is saved", () => {
  const result = presentDerivedState({ searchUnavailable: true });
  assert.equal(result.kind, "degraded");
  assert.match(result.message, /^Saved\./);
});

test("drawing save failure preserves retry semantics while success is silent", () => {
  assert.equal(presentDrawingState({ status: "saved", errorCode: "" }).message, "");
  assert.equal(presentDrawingState({ status: "error", errorCode: "KANJI_SAVE_FAILED" }).actionId, "retry-drawing-save");
});

test("rating failure says the same item is unchanged", () => {
  const result = presentJapaneseReviewState({ phase: "rating-failed" });
  assert.match(result.message, /item is unchanged/);
});

test("application recovery is non-destructive until reset confirmation", () => {
  assert.equal(
    presentApplicationRecoveryState({ storageUnavailable: true, resetConfirmationOpen: false, resetFailed: false }).kind,
    "storage-failure",
  );
  assert.equal(
    presentApplicationRecoveryState({ storageUnavailable: true, resetConfirmationOpen: true, resetFailed: false }).kind,
    "reset-confirmation",
  );
});
