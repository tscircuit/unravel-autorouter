import { CapacityMeshNodeId } from "lib/types"
import { SegmentWithAssignedPoints } from "../CapacityMeshSolver/CapacitySegmentToPointSolver"
import {
  SegmentId,
  SegmentPoint,
  SegmentPointId,
  SegmentPointMap,
} from "./types"

export const createSegmentPointMap = (
  dedupedSegments: SegmentWithAssignedPoints[],
  segmentIdToNodeIds: Map<SegmentId, CapacityMeshNodeId[]>,
): SegmentPointMap => {
  const segmentPoints: SegmentPoint[] = []
  let highestSegmentPointId = 0
  for (const segment of dedupedSegments) {
    for (const point of segment.assignedPoints!) {
      segmentPoints.push({
        segmentPointId: `SP${highestSegmentPointId++}`,
        segmentId: segment.nodePortSegmentId!,
        capacityMeshNodeIds: segmentIdToNodeIds.get(
          segment.nodePortSegmentId!,
        )!,
        connectionName: point.connectionName,
        x: point.point.x,
        y: point.point.y,
        z: point.point.z,
        directlyConnectedSegmentPointIds: [],
      })
    }
  }

  const segmentPointMap = new Map<SegmentPointId, SegmentPoint>()
  for (const segmentPoint of segmentPoints) {
    segmentPointMap.set(segmentPoint.segmentPointId, segmentPoint)
  }

  return segmentPointMap
}
