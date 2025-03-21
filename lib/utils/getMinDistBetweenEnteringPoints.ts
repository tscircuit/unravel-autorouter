import { NodeWithPortPoints } from "lib/types/high-density-types"

export const getMinDistBetweenEnteringPoints = (node: NodeWithPortPoints) => {
  let minDist = Infinity
  const points = node.portPoints

  // Compare each point with every other point
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      if (points[i].z !== points[j].z) {
        continue
      }
      const p1 = points[i]
      const p2 = points[j]

      // Calculate Euclidean distance between points
      const dist = Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2)

      minDist = Math.min(minDist, dist)
    }
  }

  return minDist === Infinity ? 0 : minDist
}
