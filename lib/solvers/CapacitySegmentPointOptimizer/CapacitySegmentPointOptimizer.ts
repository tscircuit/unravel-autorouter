import { CapacityMeshNode, CapacityMeshNodeId } from "lib/types"
import { BaseSolver } from "../BaseSolver"
import { NodePortSegment } from "lib/types/capacity-edges-to-port-segments-types"
import { SegmentWithAssignedPoints } from "../CapacityMeshSolver/CapacitySegmentToPointSolver"
import { GraphicsObject, Line, Rect } from "graphics-debug"
import { getTunedTotalCapacity1 } from "lib/utils/getTunedTotalCapacity1"
import { getIntraNodeCrossingsFromSegments } from "lib/utils/getIntraNodeCrossingsFromSegments"

type NodePortSegmentId = string

interface ChangeLayerOperation {
  op: "changeLayer"
  segmentId: string
  pointIndex: number
  newLayer: number
}

interface SwitchOperation {
  op: "switch"
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
  currentMutatedSegments: Map<NodePortSegmentId, SegmentWithAssignedPoints>
  allSegmentIds: string[]
  lastAppliedOperation: Operation | null = null

  currentNodeCosts: Record<CapacityMeshNodeId, number>

  currentCost: number
  randomSeed: number

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

    const dedupedSegments: SegmentWithAssignedPoints[] = []
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
        dedupedSegments.push(seg)
        continue
      }

      seg.nodePortSegmentId = existingSeg.nodePortSegmentId
    }

    this.currentMutatedSegments = new Map()
    // Deep clone of segments with assigned points so that we can mutate them
    for (const seg of dedupedSegments) {
      this.currentMutatedSegments.set(seg.nodePortSegmentId!, {
        ...seg,
        assignedPoints: seg.assignedPoints?.map((p) => ({
          ...p,
          point: { x: p.point.x, y: p.point.y, z: p.point.z },
        })),
      })
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

    const { cost, nodeCosts } = this.computeCurrentCost()
    this.currentCost = cost
    this.currentNodeCosts = nodeCosts

    this.randomSeed = 1
    this.allSegmentIds = Array.from(this.currentMutatedSegments.keys())
  }

  random() {
    this.randomSeed = (this.randomSeed * 16807) % 2147483647 // A simple linear congruential generator (LCG)
    return (this.randomSeed - 1) / 2147483646
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

  getRandomOperation(): Operation {
    // choose a node with more probability to higher cost nodes

    const randomSegmentId =
      this.allSegmentIds[Math.floor(this.random() * this.allSegmentIds.length)]

    const segment = this.currentMutatedSegments.get(randomSegmentId)!
    const nodes = this.segmentIdToNodeIds
      .get(randomSegmentId)!
      .map((nodeId) => this.nodeMap.get(nodeId))

    // Don't operate on nodes that contain objectives (TODO in the future we
    // can do this IF the objective is present on multiple layers)
    if (nodes.some((n) => n?._containsTarget)) {
      return this.getRandomOperation()
    }

    let operationType = this.random() < 0.5 ? "switch" : "changeLayer"
    if (segment.assignedPoints!.length <= 1) {
      operationType = "changeLayer"
    }

    if (operationType === "switch") {
      const randomPointIndex1 = Math.floor(
        this.random() * segment.assignedPoints!.length,
      )
      let randomPointIndex2 = randomPointIndex1
      while (randomPointIndex1 === randomPointIndex2) {
        randomPointIndex2 = Math.floor(
          this.random() * segment.assignedPoints!.length,
        )
      }

      return {
        op: "switch",
        segmentId: randomSegmentId,
        point1Index: randomPointIndex1,
        point2Index: randomPointIndex2,
      } as SwitchOperation
    }

    const randomPointIndex = Math.floor(
      this.random() * segment.assignedPoints!.length,
    )

    const point = segment.assignedPoints![randomPointIndex]

    return {
      op: "changeLayer",
      segmentId: randomSegmentId,
      pointIndex: randomPointIndex,
      newLayer: point.point.y > 0 ? 0 : 1,
    } as ChangeLayerOperation
  }

  computeCurrentCost(): {
    cost: number
    nodeCosts: Record<CapacityMeshNodeId, number>
  } {
    let cost = 0
    const nodeCosts: Record<CapacityMeshNodeId, number> = {}
    for (const nodeId of this.nodeIdToSegmentIds.keys()) {
      const nodeCost = this.computeNodeCost(nodeId)
      nodeCosts[nodeId] = nodeCost
      cost += nodeCost
    }
    return { cost, nodeCosts }
  }

  applyOperation(op: Operation) {}

  reverseOperation(op: Operation) {}

  isNewCostAcceptable(oldCost: number, newCost: number) {
    // TODO simultation annealing fn based using this.iterations
    return true
  }

  _step() {
    const op = this.getRandomOperation()
    this.applyOperation(op)
    const { cost: newCost, nodeCosts: newNodeCosts } = this.computeCurrentCost()

    // TODO determine if we should keep the new state
    const keepChange = this.isNewCostAcceptable(this.currentCost, newCost)

    if (!keepChange) {
      this.reverseOperation(op)
      return
    }

    this.currentCost = newCost
    this.currentNodeCosts = newNodeCosts
    this.lastAppliedOperation = op
  }

  visualize(): GraphicsObject {
    const graphics: Required<GraphicsObject> = {
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
      coordinateSystem: "cartesian",
      title: "Capacity Segment Point Optimizer",
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

    // Add visualization for the last applied operation
    if (this.lastAppliedOperation) {
      const segment = this.currentMutatedSegments.get(
        this.lastAppliedOperation.segmentId,
      )!
      const node = this.nodeMap.get(segment.capacityMeshNodeId)!
      // Create a circle around the node
      graphics.circles.push({
        center: { x: node.center.x, y: node.center.y + node.height / 4 },
        radius: node.width / 4,
        stroke: "#0000ff",
        fill: "rgba(0, 0, 255, 0.2)",
        label: "LAST OPERATION",
      })

      // For both operation types, we'll highlight the affected points
      if (this.lastAppliedOperation.op === "changeLayer") {
        const point =
          segment.assignedPoints![this.lastAppliedOperation.pointIndex]
        graphics.circles.push({
          center: { x: point.point.x, y: point.point.y },
          radius: this.nodeMap.get(segment.capacityMeshNodeId)!.width / 8,
          stroke: "#ff0000",
          fill: "rgba(255, 0, 0, 0.2)",
          label: "Layer Changed",
        })
      } else if (this.lastAppliedOperation.op === "switch") {
        // For switch operations, highlight both points that were swapped
        const point1 =
          segment.assignedPoints![this.lastAppliedOperation.point1Index]
        const point2 =
          segment.assignedPoints![this.lastAppliedOperation.point2Index]

        // Add circles around both swapped points
        graphics.circles.push(
          {
            center: { x: point1.point.x, y: point1.point.y },
            radius: 5,
            stroke: "#00ff00",
            fill: "rgba(0, 255, 0, 0.2)",
            label: "Swapped 1",
          },
          {
            center: { x: point2.point.x, y: point2.point.y },
            radius: 5,
            stroke: "#00ff00",
            fill: "rgba(0, 255, 0, 0.2)",
            label: "Swapped 2",
          },
        )

        // Add a connecting line between the swapped points
        graphics.lines.push({
          points: [
            { x: point1.point.x, y: point1.point.y },
            { x: point2.point.x, y: point2.point.y },
          ],
          strokeColor: "#00ff00",
          strokeDash: "3 3",
          strokeWidth: 1,
        })
      }
    }

    return graphics
  }
}
