import type { CapacityMeshNodeId } from "lib/types"

export type SegmentPointId = string
export type SegmentId = string

export type UnravelViaIssue = {
  type: "via"
  capacityMeshNodeId: CapacityMeshNodeId
  segmentPoints: SegmentPointId[]
}

export type UnravelCrossingIssue = {
  type: "crossing"
  capacityMeshNodeId: CapacityMeshNodeId
  crossingLines: Array<[SegmentPointId, SegmentPointId]>
}

export interface SegmentPoint {
  segmentPointId: SegmentPointId
  segmentId: string
  capacityMeshNodeIds: CapacityMeshNodeId[]
  x: number
  y: number
  z: number
}

export type SegmentPointMap = Map<SegmentPointId, SegmentPoint>

export type UnravelIssue = UnravelViaIssue | UnravelCrossingIssue

export interface UnravelSection {
  allNodeIds: CapacityMeshNodeId[]
  mutableNodeIds: CapacityMeshNodeId[]
  immutableNodeIds: CapacityMeshNodeId[]
  segmentPointMap: SegmentPointMap
  segmentPointsInNode: Map<CapacityMeshNodeId, SegmentPointId[]>
  segmentPointsInSegment: Map<SegmentId, SegmentPointId[]>
}

export type UnravelCandidate = {
  operationsPerformed: number

  /**
   * A hash of the pointModifications to know if this candidate has already been
   * explored
   */
  candidateHash: string

  pointModifications: Map<
    SegmentPointId,
    {
      x?: number
      y?: number
      z?: number
    }
  >

  issues: UnravelIssue[]

  /**
   * The cost of this candidate (log probability of failure) considering all of
   * the point modifications
   */
  g: number

  /**
   * The estimated cost of this candidate (log probability of failure). We don't
   * currently know how to compute this so it's always 0.
   */
  h: number

  /**
   * Candidate cost ~(g + h)
   */
  f: number
}
