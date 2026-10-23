// Daily picks for the Explore tab. The picks are chosen in the browser from the lists the mode pages already load,
// seeded by the learner's local date, so they stay the same all day and change at midnight. No backend call.

/** A small seeded random generator (xmur3 hash). Same seed, same sequence. */
export function seeded(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

/** `n` items for today: shuffled by the day's seed, with items the learner has not finished first. */
export function pickDaily<T>(items: T[], n: number, day: string, salt: string, done: (t: T) => boolean = () => false): T[] {
  const rand = seeded(`${day}:${salt}`);
  const mixed = items.map((item) => ({ item, key: rand() }));
  mixed.sort((a, b) => a.key - b.key);
  const open = mixed.filter((m) => !done(m.item));
  const finished = mixed.filter((m) => done(m.item));
  return [...open, ...finished].slice(0, n).map((m) => m.item);
}
