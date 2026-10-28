/** Small seeded PRNG. All simulation randomness must use this, never Math.random. */
export function random(seed = 1) {
  let value = Number(seed) >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let n = value;
    n = Math.imul(n ^ (n >>> 15), n | 1);
    n ^= n + Math.imul(n ^ (n >>> 7), n | 61);
    return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
  };
}

export function hash(value) {
  let n = 2166136261;
  for (const char of String(value))
    n = Math.imul(n ^ char.charCodeAt(0), 16777619);
  return n >>> 0;
}
