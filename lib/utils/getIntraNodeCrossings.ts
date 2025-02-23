import { doSegmentsIntersect } from "@tscircuit/math-utils"
import { NodeWithPortPoints } from "lib/types/high-density-types"

export const getIntraNodeCrossings = (node: NodeWithPortPoints) => {
  // Count the number of crossings
  let numCrossings = 0
  const pointPairs: {
    points: { x: number; y: number }[]
    connectionName: string
  }[] = []

  for (const A of node.portPoints) {
    if (pointPairs.some((p) => p.connectionName === A.connectionName)) {
      continue
    }
    const pointPair = {
      connectionName: A.connectionName,
      points: [{ x: A.x, y: A.y }],
    }
    for (const B of node.portPoints) {
      if (A.connectionName !== B.connectionName) continue
      if (A.x === B.x && A.y === B.y) continue
      pointPair.points.push({ x: B.x, y: B.y })
    }
    pointPairs.push(pointPair)
  }

  for (let i = 0; i < pointPairs.length; i++) {
    for (let j = i + 1; j < pointPairs.length; j++) {
      const pair1 = pointPairs[i]
      const pair2 = pointPairs[j]
      if (
        doSegmentsIntersect(
          pair1.points[0],
          pair1.points[1],
          pair2.points[0],
          pair2.points[1],
        )
      ) {
        numCrossings++
      }
    }
  }

  return numCrossings
}
