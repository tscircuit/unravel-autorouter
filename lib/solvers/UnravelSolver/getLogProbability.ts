export const getLogProbability = (probability: number) => {
  const K = -2.3
  return 1 - Math.exp(probability * K)
}
