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

      this.nodePfMap.set(nodeId, probabilityOfFailure)
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
      })
    }

    this.activeSolver.step()

    if (this.activeSolver.solved) {
      // Incorporate the changes from the active solver
      this.activeSolver = null
    }
  }

  visualize(): GraphicsObject {
    if (this.activeSolver) {
      return this.activeSolver.visualize()
    }

    return {}
  }
}
