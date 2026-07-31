import assert from "node:assert/strict";
import test from "node:test";
import { createBacklinkIndex, getActiveBacklinkIndex } from "../../core/backlinks.js";
import { createCommandStack, getActiveCommandStack } from "../../core/commandStack.js";
import { createHistory, getActiveHistory } from "../../core/history.js";
import { createStore, getActiveStore } from "../../core/state.js";

test("runtime bridge getters expose only the most recently created shared instances", async () => {
  const firstStore = createStore({ value: 1 });
  const secondStore = createStore({ value: 2 });
  assert.notStrictEqual(firstStore, secondStore);
  assert.strictEqual(getActiveStore(), secondStore);
  secondStore.setState({ value: 3 });
  assert.equal(getActiveStore().getState().value, 3);

  const commandStack = createCommandStack();
  assert.strictEqual(getActiveCommandStack(), commandStack);
  let value = 0;
  await commandStack.execute({
    async do() {
      value += 1;
    },
    async undo() {
      value -= 1;
    },
  });
  assert.equal(value, 1);

  const history = createHistory();
  assert.strictEqual(getActiveHistory(), history);
  history.record({ op: "test" });
  assert.deepEqual(getActiveHistory().getOperations(), [{ op: "test" }]);

  const backlinks = createBacklinkIndex();
  assert.strictEqual(getActiveBacklinkIndex(), backlinks);
  backlinks.rebuild([]);
  assert.deepEqual(getActiveBacklinkIndex().toMap(), new Map());
});
