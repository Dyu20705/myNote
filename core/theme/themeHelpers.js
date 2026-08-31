/**
 * @fileoverview Theme Helper Utilities.
 * Zero external runtime dependencies.
 */

/**
 * Deep freezes an object recursively to prevent nested mutations.
 *
 * @template T
 * @param {T} obj
 * @returns {Readonly<T>}
 */
export function deepFreeze(obj) {
  if (obj && typeof obj === "object" && !Object.isFrozen(obj)) {
    Object.freeze(obj);
    for (const value of Object.values(obj)) {
      if (value && typeof value === "object" && !Object.isFrozen(value)) {
        deepFreeze(value);
      }
    }
  }
  return obj;
}
