import { CapacityMeshNode, CapacityMeshNodeId } from "lib/types"
import { BaseSolver } from "../BaseSolver"
import { NodePortSegment } from "lib/types/capacity-edges-to-port-segments-types"
import { SegmentWithAssignedPoints } from "../CapacityMeshSolver/CapacitySegmentToPointSolver"
import { GraphicsObject } from "graphics-debug"

interface ChangeLayerOperation {
  segmentId: string
  pointIndex: number
  newLayer: number
}

interface SwitchOperation {
  segmentId: string
  point1Index: number
  point2Index: number
}

/**
 * Use simulated annealing to try to improve the placement of points (via
 * swapping with points on the same segment) or changing the layer.
 *
 * We have the following pieces of information:
 * - NodePortSegment with nodePortSegmentId
 * - A "neighbor" NodePortSegmentWithAssignedPoints has one change
 *    - A change can be flipping a point to the opposite layer
 *    - A change can also be switching the position of two points
 * - We represent the operations used to change from an original scene
 *   with a list of operations [SEG1_CL(1, 1), SEG1_SW(1, 2), SEG2_CL(2, 0)]
 *    - CN indicates the capacity node to edit
 *    - The SW operation "switches" the x/y location of two points
 *    - The CL operation changes the layer of the point
 * - When choosing edits to make, we are biased to operate on nodes that have a
 *   high cost and biased against operating on nodes we've operated on a lot
 * - Each step, we generate an operation and use the standard simulated
 *   annealing function to determine if we should perform the operation
 */
export class CapacitySegmentPointOptimizer extends BaseSolver {
  assignedSegments: SegmentWithAssignedPoints[]
  colorMap: Record<string, string>
  nodeMap: Record<CapacityMeshNodeId, CapacityMeshNode>

  nodeIdToSegmentIds: Map<string, string[]>
  segmentIdToNodeIds: Map<string, string[]>

  // We use an extra property on segments to remember assigned points.
  // Each segment will get an added property "assignedPoints" which is an array of:
  // { connectionName: string, point: {x: number, y: number } }
  // This is a temporary extension used by the solver.
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
    this.MAX_ITERATIONS = 100_000

    // TODO it is likely there are duplicate segments, we should de-duplicate
    this.assignedSegments = assignedSegments.map((s, i) => ({
      ...s,
      nodePortSegmentId: `SEG${i}`,
    }))

    this.nodeIdToSegmentIds = new Map()
    this.segmentIdToNodeIds = new Map()

    for (const segment of this.assignedSegments) {
      this.segmentIdToNodeIds.set(segment.nodePortSegmentId!, [
        segment.capacityMeshNodeId,
      ])
      this.nodeIdToSegmentIds.set(segment.capacityMeshNodeId, [
        segment.nodePortSegmentId!,
      ])
    }

    this.colorMap = colorMap ?? {}
    this.nodeMap = Object.fromEntries(
      nodes.map((node) => [node.capacityMeshNodeId, node]),
    )
  }

  computeNodeCost(nodeId: CapacityMeshNodeId) {}

  visualize(): GraphicsObject {
    return {}
  }
}
