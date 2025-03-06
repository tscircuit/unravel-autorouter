import { CapacityMeshNode, CapacityMeshNodeId } from "lib/types"
import { getTunedTotalCapacity1 } from "lib/utils/getTunedTotalCapacity1"
import { SegmentWithAssignedPoints } from "../CapacityMeshSolver/CapacitySegmentToPointSolver"
import { UnravelSectionSolver } from "./UnravelSectionSolver"
import { getIntraNodeCrossings } from "lib/utils/getIntraNodeCrossings"
import { NodePortSegment } from "lib/types/capacity-edges-to-port-segments-types"
import { getDedupedSegments } from "./getDedupedSegments"
import { getIntraNodeCrossingsFromSegments } from "lib/utils/getIntraNodeCrossingsFromSegments"
import { calculateNodeProbabilityOfFailure } from "./calculateCrossingProbabilityOfFailure"
import { BaseSolver } from "../BaseSolver"
import { GraphicsObject } from "graphics-debug"
import { NodeWithPortPoints } from "lib/types/high-density-types"
import {
  PointModificationsMap,
  SegmentId,
  SegmentPointId,
  SegmentPointMap,
} from "./types"
import { createSegmentPointMap } from "./createSegmentPointMap"

export class UnravelMultiSectionSolver extends BaseSolver {
  nodeMap: Map<CapacityMeshNodeId, CapacityMeshNode>
  dedupedSegments: SegmentWithAssignedPoints[]
  nodeIdToSegmentIds: Map<CapacityMeshNodeId, CapacityMeshNodeId[]>
  segmentIdToNodeIds: Map<CapacityMeshNodeId, CapacityMeshNodeId[]>
  colorMap: Record<string, string>
  tunedNodeCapacityMap: Map<CapacityMeshNodeId, number>

  /**
   * Probability of failure for each node
   */
  nodePfMap: Map<CapacityMeshNodeId, number>

  activeSolver: UnravelSectionSolver | null = null

  segmentPointMap: SegmentPointMap

  constructor({
    assignedSegments,
    colorMap,
    nodes,
  }: {
    assignedSegments: NodePortSegment[]
    colorMap?: Record<string, string>
    /**
     * This isn't used by the algorithm, but allows associating metadata
     * for the result datatype (the center, width, height of the node)
     */
    nodes: CapacityMeshNode[]
  }) {
    super()

    this.dedupedSegments = getDedupedSegments(assignedSegments)
    this.nodeMap = new Map()
    for (const node of nodes) {
      this.nodeMap.set(node.capacityMeshNodeId, node)
    }

    this.nodeIdToSegmentIds = new Map()
    this.segmentIdToNodeIds = new Map()

    for (const segment of assignedSegments) {
      this.segmentIdToNodeIds.set(segment.nodePortSegmentId!, [
        ...(this.segmentIdToNodeIds.get(segment.nodePortSegmentId!) ?? []),
        segment.capacityMeshNodeId,
      ])
      this.nodeIdToSegmentIds.set(segment.capacityMeshNodeId, [
        ...(this.nodeIdToSegmentIds.get(segment.capacityMeshNodeId) ?? []),
        segment.nodePortSegmentId!,
      ])
    }

    this.colorMap = colorMap ?? {}

    // Compute tuned capacity for each node
    this.tunedNodeCapacityMap = new Map()
    for (const [nodeId, node] of this.nodeMap) {
      this.tunedNodeCapacityMap.set(nodeId, getTunedTotalCapacity1(node))
    }

    this.segmentPointMap = createSegmentPointMap(
      this.dedupedSegments,
      this.segmentIdToNodeIds,
    )

    this.nodePfMap = this.computeInitialPfMap()
  }

  computeInitialPfMap() {
    const pfMap = new Map<CapacityMeshNodeId, number>()

    for (const [nodeId, node] of this.nodeMap) {
      const {
        numSameLayerCrossings,
        numEntryExitLayerChanges,
        numTransitionCrossings,
      } = getIntraNodeCrossingsFromSegments(
        this.dedupedSegments.filter((seg) => {
          const capacityNodeIds = this.segmentIdToNodeIds.get(
            seg.nodePortSegmentId!,
          )
          return capacityNodeIds?.includes(nodeId)
        }),
      )

      const probabilityOfFailure = calculateNodeProbabilityOfFailure(
        node,
        numSameLayerCrossings,
        numEntryExitLayerChanges,
        numTransitionCrossings,
      )

      pfMap.set(nodeId, probabilityOfFailure)
    }

    return pfMap
  }

  _step() {
    if (!this.activeSolver) {
      // Find the node with the highest probability of failure
      let highestPfNodeId = null
      let highestPf = 0
      for (const [nodeId, pf] of this.nodePfMap.entries()) {
        if (pf > highestPf) {
          highestPf = pf
          highestPfNodeId = nodeId
        }
      }

      if (!highestPfNodeId || highestPf < 0.01) {
        this.solved = true
        return
      }

      this.activeSolver = new UnravelSectionSolver({
        dedupedSegments: this.dedupedSegments,
        nodeMap: this.nodeMap,
        nodeIdToSegmentIds: this.nodeIdToSegmentIds,
        segmentIdToNodeIds: this.segmentIdToNodeIds,
        colorMap: this.colorMap,
        rootNodeId: highestPfNodeId,
        MUTABLE_HOPS: 1,
        segmentPointMap: this.segmentPointMap,
      })
    }

    this.activeSolver.step()

    if (this.activeSolver.solved) {
      // Incorporate the changes from the active solver
      const { bestCandidate, originalCandidate } = this.activeSolver

      const foundBetterSolution =
        bestCandidate && bestCandidate.g < originalCandidate!.g

      if (foundBetterSolution) {
        // Modify the points using the pointModifications of the candidate
        for (const [
          segmentPointId,
          pointModification,
        ] of bestCandidate.pointModifications.entries()) {
          const segmentPoint = this.segmentPointMap.get(segmentPointId)!
          segmentPoint.x = pointModification.x ?? segmentPoint.x
          segmentPoint.y = pointModification.y ?? segmentPoint.y
          segmentPoint.z = pointModification.z ?? segmentPoint.z
        }
      }

      this.activeSolver = null
      this.solved = true
    }
  }

  visualize(): GraphicsObject {
    if (this.activeSolver) {
      console.log("Visualizing active solver")
      const viz = this.activeSolver.visualize()
      console.log("viz", viz)
      return this.activeSolver.visualize()
    }

    const graphics: GraphicsObject = {
      lines: [],
    }

    // Draw each segment
    // TODO draw problem
    for (const segment of this.dedupedSegments) {
      graphics.lines!.push({
        points: [segment.start, segment.end],
      })
    }
    return graphics
  }

  getNodesWithPortPoints(): NodeWithPortPoints[] {
    if (!this.solved) {
      throw new Error(
        "CapacitySegmentToPointSolver not solved, can't give port points yet",
      )
    }
    const nodeWithPortPointsMap = new Map<string, NodeWithPortPoints>()
    for (const segment of this.dedupedSegments) {
      const segId = segment.nodePortSegmentId!
      for (const nodeId of this.segmentIdToNodeIds.get(segId)!) {
        const node = this.nodeMap.get(nodeId)!
        if (!nodeWithPortPointsMap.has(nodeId)) {
          nodeWithPortPointsMap.set(nodeId, {
            capacityMeshNodeId: nodeId,
            portPoints: [],
            center: node.center,
            width: node.width,
            height: node.height,
          })
        }
      }
    }

    for (const segmentPoint of this.segmentPointMap.values()) {
      for (const nodeId of segmentPoint.capacityMeshNodeIds) {
        const nodeWithPortPoints = nodeWithPortPointsMap.get(nodeId)
        if (nodeWithPortPoints) {
          nodeWithPortPoints.portPoints.push({
            x: segmentPoint.x,
            y: segmentPoint.y,
            z: segmentPoint.z,
            connectionName: segmentPoint.connectionName,
          })
        }
      }
    }

    return Array.from(nodeWithPortPointsMap.values())
  }
}
