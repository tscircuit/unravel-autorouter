function seededRandom(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647 // A simple linear congruential generator (LCG)
    return (seed - 1) / 2147483646
  }
}

export function cloneAndShuffleArray<T>(arr: T[], seed: number): T[] {
  if (seed === 0) return arr
  const random = seededRandom(seed)
  const shuffled = arr.slice() // Copy the array
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}
