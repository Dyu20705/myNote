import assert from "node:assert/strict";
import test from "node:test";
import { createStore } from "../../core/state.js";

test("store copies initial state and shallow-merges object and functional patches in order", () => {
  const initial = { count: 1, stable: "kept" };
  const store = createStore(initial);

  store.setState({ count: 2 });
  store.setState((state) => ({ count: state.count + 3, added: true }));

  assert.deepEqual(initial, { count: 1, stable: "kept" });
  assert.deepEqual(store.getState(), { count: 5, stable: "kept", added: true });
});

test("store notifies each active subscriber once with the committed state", () => {
  const store = createStore({ count: 0 });
  const firstSeen = [];
  const secondSeen = [];
  store.subscribe((state) => firstSeen.push(state.count));
  store.subscribe((state) => secondSeen.push(state.count));

  const committed = store.setState({ count: 1 });

  assert.equal(committed, store.getState());
  assert.deepEqual(firstSeen, [1]);
  assert.deepEqual(secondSeen, [1]);
});

test("unsubscribed store listeners receive no later notifications", () => {
  const store = createStore({ count: 0 });
  const seen = [];
  const unsubscribe = store.subscribe((state) => seen.push(state.count));

  store.setState({ count: 1 });
  assert.equal(unsubscribe(), true);
  store.setState({ count: 2 });

  assert.deepEqual(seen, [1]);
});
