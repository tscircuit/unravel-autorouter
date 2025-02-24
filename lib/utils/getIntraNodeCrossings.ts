import { doSegmentsIntersect } from "@tscircuit/math-utils"
import { NodeWithPortPoints } from "lib/types/high-density-types"

export const getIntraNodeCrossings = (node: NodeWithPortPoints) => {
  // Count the number of crossings
  let numSameLayerCrossings = 0
  const pointPairs: {
    points: { x: number; y: number; z: number }[]
    z: number
    connectionName: string
  }[] = []

  const transitionPairPoints: {
    points: { x: number; y: number; z: number }[]
    connectionName: string
  }[] = []

  let numEntryExitLayerChanges = 0

  for (const A of node.portPoints) {
    if (pointPairs.some((p) => p.connectionName === A.connectionName)) {
      continue
    }
    if (
      transitionPairPoints.some((p) => p.connectionName === A.connectionName)
    ) {
      continue
    }
    const pointPair = {
      connectionName: A.connectionName,
      z: A.z,
      points: [{ x: A.x, y: A.y, z: A.z }],
    }
    for (const B of node.portPoints) {
      if (A.connectionName !== B.connectionName) continue
      if (A.x === B.x && A.y === B.y) continue
      pointPair.points.push({ x: B.x, y: B.y, z: B.z })
    }
    if (pointPair.points.some((p) => p.z !== pointPair.z)) {
      numEntryExitLayerChanges++
      transitionPairPoints.push(pointPair)
      continue
    }
    pointPairs.push(pointPair)
  }

  for (let i = 0; i < pointPairs.length; i++) {
    for (let j = i + 1; j < pointPairs.length; j++) {
      const pair1 = pointPairs[i]
      const pair2 = pointPairs[j]
      if (
        pair1.z === pair2.z &&
        doSegmentsIntersect(
          pair1.points[0],
          pair1.points[1],
          pair2.points[0],
          pair2.points[1],
        )
      ) {
        numSameLayerCrossings++
      }
    }
  }

  let numTransitionPairCrossings = 0
  for (let i = 0; i < transitionPairPoints.length; i++) {
    for (let j = i + 1; j < transitionPairPoints.length; j++) {
      const pair1 = transitionPairPoints[i]
      const pair2 = transitionPairPoints[j]

      if (
        doSegmentsIntersect(
          pair1.points[0],
          pair1.points[1],
          pair2.points[0],
          pair2.points[1],
        )
      ) {
        numTransitionPairCrossings++
      }
    }
  }

  return {
    numSameLayerCrossings,
    numEntryExitLayerChanges,
    numTransitionPairCrossings,
    numTransitions: transitionPairPoints.length,
  }
}
