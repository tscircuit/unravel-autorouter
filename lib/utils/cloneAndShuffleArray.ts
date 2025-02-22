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
  for (let i = 0; i < shuffled.length; i++) {
    const i1 = Math.floor(random() * shuffled.length)
    const i2 = Math.floor(random() * (i + 1))
    ;[shuffled[i1], shuffled[i2]] = [shuffled[i2], shuffled[i1]]
  }
  return shuffled
}
