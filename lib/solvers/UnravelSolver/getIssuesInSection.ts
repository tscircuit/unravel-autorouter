import { CapacityMeshNode, CapacityMeshNodeId } from "lib/types"
import {
  UnravelSection,
  UnravelIssue,
  UnravelTransitionViaIssue,
  SegmentPoint,
  SegmentPointId,
  UnravelSameLayerCrossingIssue,
} from "./types"
import { getIntraNodeCrossingsFromSegments } from "lib/utils/getIntraNodeCrossingsFromSegments"
import { getTunedTotalCapacity1 } from "lib/utils/getTunedTotalCapacity1"
import { getLogProbability } from "./getLogProbability"
import { doSegmentsIntersect } from "@tscircuit/math-utils"
import { ConnectivityMap } from "circuit-json-to-connectivity-map"
import { hasZRangeOverlap } from "./hasZRangeOverlap"

export const getIssuesInSection = (
  section: UnravelSection,
  nodeMap: Map<CapacityMeshNodeId, CapacityMeshNode>,
  pointModifications: Map<
    SegmentPointId,
    { x?: number; y?: number; z?: number }
  >,
  connMap?: ConnectivityMap,
): UnravelIssue[] => {
  const issues: UnravelIssue[] = []

  const getPoint = (segmentPointId: SegmentPointId) => {
    const point = section.segmentPointMap.get(segmentPointId)!
    return {
      x: pointModifications.get(point.segmentPointId)?.x ?? point.x,
      y: pointModifications.get(point.segmentPointId)?.y ?? point.y,
      z: pointModifications.get(point.segmentPointId)?.z ?? point.z,
    }
  }

  for (const nodeId of section.allNodeIds) {
    const node = nodeMap.get(nodeId)
    if (!node) continue

    const nodeSegmentPairs = section.segmentPairsInNode.get(nodeId)!

    // If there's a Z transition within the pair, there's a transition_via issue
    for (const pair of nodeSegmentPairs) {
      const A = getPoint(pair[0])!
      const B = getPoint(pair[1])!
      if (A.z !== B.z) {
        issues.push({
          type: "transition_via",
          segmentPoints: pair,
          capacityMeshNodeId: nodeId,
          probabilityOfFailure: 0,
        })
      }
    }

    // Find crossing issues
    for (let i = 0; i < nodeSegmentPairs.length; i++) {
      for (let j = i + 1; j < nodeSegmentPairs.length; j++) {
        if (
          connMap?.areIdsConnected(
            nodeSegmentPairs[i][0],
            nodeSegmentPairs[i][1],
          )
        ) {
          continue
        }

        const pair1 = nodeSegmentPairs[i]
        const pair2 = nodeSegmentPairs[j]

        const A = getPoint(pair1[0])!
        const B = getPoint(pair1[1])!
        const C = getPoint(pair2[0])!
        const D = getPoint(pair2[1])!

        // Are the lines ever on the same layer? Is there any risk of overlap?
        if (!hasZRangeOverlap(A.z, B.z, C.z, D.z)) continue

        const areCrossing = doSegmentsIntersect(A, B, C, D)
        const isSameLayer = A.z === B.z && C.z === D.z && A.z === C.z
        if (areCrossing && isSameLayer) {
          issues.push({
            type: "same_layer_crossing",
            segmentPoints: [pair1, pair2],
            capacityMeshNodeId: nodeId,
            crossingLine1: pair1,
            crossingLine2: pair2,
            probabilityOfFailure: 0,
          } as UnravelSameLayerCrossingIssue)
        }
      }
    }
  }

  return issues
}
