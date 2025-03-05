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

    const nodeSegmentPoints = section.segmentPointsInNode.get(nodeId)!

    if (nodeSegmentPoints.length === 2) {
      // This node may have a via issue
    }

    // Get via issues
  }

  return issues
}
