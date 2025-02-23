import { CapacityMeshNode, CapacityMeshNodeId } from "lib/types"
import { BaseSolver } from "../BaseSolver"
import { NodePortSegment } from "lib/types/capacity-edges-to-port-segments-types"
import { SegmentWithAssignedPoints } from "../CapacityMeshSolver/CapacitySegmentToPointSolver"
import { GraphicsObject, Line, Rect } from "graphics-debug"
import { getTunedTotalCapacity1 } from "lib/utils/getTunedTotalCapacity1"
import { getIntraNodeCrossingsFromSegments } from "lib/utils/getIntraNodeCrossingsFromSegments"

type NodePortSegmentId = string

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

type Operation = ChangeLayerOperation | SwitchOperation

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
  nodeMap: Map<CapacityMeshNodeId, CapacityMeshNode>

  nodeIdToSegmentIds: Map<string, string[]>
  segmentIdToNodeIds: Map<string, string[]>
  dedupedSegments: SegmentWithAssignedPoints[]
  currentMutatedSegments: Map<NodePortSegmentId, SegmentWithAssignedPoints>

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

    this.assignedSegments = assignedSegments

    this.dedupedSegments = []
    type SegKey = `${number}-${number}-${number}-${number}`
    const dedupedSegPointMap: Map<SegKey, NodePortSegment> = new Map()
    let highestSegmentId = -1
    for (const seg of this.assignedSegments) {
      // Check if there's another segment with the same start and end
      const segKey: SegKey = `${seg.start.x}-${seg.start.y}-${seg.end.x}-${seg.end.y}`
      const existingSeg = dedupedSegPointMap.get(segKey)
      if (!existingSeg) {
        highestSegmentId++
        seg.nodePortSegmentId = `SEG${highestSegmentId}`
        dedupedSegPointMap.set(segKey, seg)
        this.dedupedSegments.push(seg)
        continue
      }

      seg.nodePortSegmentId = existingSeg.nodePortSegmentId
    }

    this.currentMutatedSegments = new Map()
    for (const seg of this.dedupedSegments) {
      this.currentMutatedSegments.set(seg.nodePortSegmentId!, { ...seg })
    }

    this.nodeIdToSegmentIds = new Map()
    this.segmentIdToNodeIds = new Map()

    for (const segment of this.assignedSegments) {
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
    this.nodeMap = new Map()
    for (const node of nodes) {
      this.nodeMap.set(node.capacityMeshNodeId, node)
    }
  }

  computeNodeCost(nodeId: CapacityMeshNodeId) {
    const totalCapacity = getTunedTotalCapacity1(this.nodeMap.get(nodeId)!)
    const usedCapacity = this.getUsedGranularCapacity(nodeId)

    return usedCapacity / totalCapacity
  }

  /**
   * Granular capacity is a consideration of capacity that includes...
   * - The number of traces
   * - The number of trace crossings (0-2 vias per trace crossing)
   *   - Empirically, each crossing typically results in 0.82 vias
   *   - e.g. 17 traces would typically have 51 crossings & 42 vias
   * - The number of layer changes (at least 1 via per layer change)
   *   - We don't know how a entry/exit being on separated layers effects
   *     the capacity/number of vias yet
   *
   * - Generally minimizing the number of crossings is pretty good, if there
   *   is no trace crossing you basically don't have any used capacity
   * - If the entry/exit layer is different, you're guaranteed to have at least
   *   one via
   *
   * - Total capacity is computed by estimating the number of vias that could
   *   be created using the formula (viaFitAcross / 2) ** 1.1
   */
  getUsedGranularCapacity(nodeId: CapacityMeshNodeId) {
    const segmentIds = this.nodeIdToSegmentIds.get(nodeId)!
    console.log({ nodeId, segmentIds })
    const segments = segmentIds.map(
      (segmentId) => this.currentMutatedSegments.get(segmentId)!,
    )!
    const { numEntryExitLayerChanges, numSameLayerCrossings } =
      getIntraNodeCrossingsFromSegments(segments)

    const estNumVias =
      numSameLayerCrossings * 0.82 + numEntryExitLayerChanges * 0.5

    const estUsedCapacity = (estNumVias / 2) ** 1.1

    return estUsedCapacity
  }

  getRandomOperation() {
    // TODO
    // 1. compute the cost of every node
    // 2. choose a node with more probability to higher cost nodes
    // 3. choose a random segment on the node
    // 4. choose a random operation on the segment
  }

  applyOperation(op: Operation) {
    // TODO
  }

  visualize(): GraphicsObject {
    const graphics = {
      points: [...this.currentMutatedSegments.values()].flatMap((seg, i) =>
        seg.assignedPoints!.map((ap) => ({
          x: ap.point.x,
          y: ap.point.y,
          label: `${seg.nodePortSegmentId}`,
          color: this.colorMap[ap.connectionName],
        })),
      ),
      lines: [...this.currentMutatedSegments.values()].map((seg) => ({
        points: [seg.start, seg.end],
      })),
      rects: [
        ...[...this.nodeMap.values()].map(
          (node) =>
            ({
              center: node.center,
              label: `${this.computeNodeCost(node.capacityMeshNodeId)}`,
              color: "red",
              width: node.width / 8,
              height: node.height / 8,
            }) as Rect,
        ),
      ],
      circles: [],
    }

    // Add a dashed line connecting the assignment points with the same
    // connection name within the same node
    const dashedLines: Line[] = []
    const nodeConnections: Record<
      CapacityMeshNodeId,
      Record<string, { x: number; y: number }[]>
    > = {}
    for (const seg of this.assignedSegments) {
      const nodeId = seg.capacityMeshNodeId
      if (!nodeConnections[nodeId]) {
        nodeConnections[nodeId] = {}
      }
      for (const ap of seg.assignedPoints!) {
        if (!nodeConnections[nodeId][ap.connectionName]) {
          nodeConnections[nodeId][ap.connectionName] = []
        }
        nodeConnections[nodeId][ap.connectionName].push({
          x: ap.point.x,
          y: ap.point.y,
        })
      }
    }
    for (const nodeId in nodeConnections) {
      for (const conn in nodeConnections[nodeId]) {
        const points = nodeConnections[nodeId][conn]
        if (points.length > 1) {
          dashedLines.push({
            points,
            strokeDash: "5 5",
            strokeColor: this.colorMap[conn] || "#000",
          } as Line)
        }
      }
    }
    graphics.lines.push(...(dashedLines as any))

    return graphics
  }
}
