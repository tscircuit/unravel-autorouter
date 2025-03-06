import { CapacityMeshNode, CapacityMeshNodeId } from "lib/types"
import {
  UnravelSection,
  UnravelIssue,
  UnravelTransitionViaIssue,
  UnravelCrossingIssue,
  SegmentPoint,
  SegmentPointId,
} from "../CapacitySegmentPointOptimizer/types"
import { getIntraNodeCrossingsFromSegments } from "lib/utils/getIntraNodeCrossingsFromSegments"
import { getTunedTotalCapacity1 } from "lib/utils/getTunedTotalCapacity1"
import { getLogProbability } from "./getLogProbability"

export const getIssuesInSection = (
  section: UnravelSection,
  nodeMap: Map<CapacityMeshNodeId, CapacityMeshNode>,
  pointModifications: Map<
    SegmentPointId,
    { x?: number; y?: number; z?: number }
  >,
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
          nodeId,
          segmentPoints: [A, B],
          capacityMeshNodeId: nodeId,
        })
      }
    }
  }

  return issues
}
