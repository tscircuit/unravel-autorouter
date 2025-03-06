import { CapacityMeshNode, CapacityMeshNodeId } from "lib/types"
import {
  UnravelSection,
  UnravelIssue,
  UnravelTransitionViaIssue,
  SegmentPoint,
  SegmentPointId,
} from "./types"
import { getIntraNodeCrossingsFromSegments } from "lib/utils/getIntraNodeCrossingsFromSegments"
import { getTunedTotalCapacity1 } from "lib/utils/getTunedTotalCapacity1"
import { getLogProbability } from "./getLogProbability"
import { doSegmentsIntersect } from "@tscircuit/math-utils"
import { ConnectivityMap } from "circuit-json-to-connectivity-map"

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

  for (const nodeId of section.allNodeIds) {
    const node = nodeMap.get(nodeId)
    if (!node) continue

    const nodeSegmentPairs = section.segmentPairsInNode.get(nodeId)!

    // If there's a Z transition within the pair, there's a transition_via issue
    for (const pair of nodeSegmentPairs) {
      const A = section.segmentPointMap.get(pair[0])!
      const B = section.segmentPointMap.get(pair[1])!
      const Az = pointModifications.get(A.segmentPointId)?.z ?? A.z
      const Bz = pointModifications.get(B.segmentPointId)?.z ?? B.z
      if (Az !== Bz) {
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
          !connMap?.areIdsConnected(
            nodeSegmentPairs[i][0],
            nodeSegmentPairs[i][1],
          )
        ) {
          continue
        }

        const connectionName2 = connMap?.areIdsConnected(
          nodeSegmentPairs[j][0],
          nodeSegmentPairs[j][1],
        )
        const pair1 = nodeSegmentPairs[i]
        const pair2 = nodeSegmentPairs[j]
        const crossing = doSegmentsIntersect(pair1, pair2)
      }
    }
  }

  return issues
}
