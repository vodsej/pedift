// Monotonic, session-unique id generator. Ids are only used in-memory (page
// slots, overlay objects), so a counter is enough — and being deterministic
// keeps unit tests stable (no Math.random / Date.now).
let counter = 0

export function nextId(prefix = 'id'): string {
  counter += 1
  return `${prefix}_${counter.toString(36)}`
}

/** Test helper: reset the counter so id sequences are reproducible. */
export function resetIds(): void {
  counter = 0
}
