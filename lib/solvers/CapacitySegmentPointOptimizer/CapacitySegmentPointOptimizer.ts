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

  /** Operation is mutated and oldLayer is added to allow reversal */
  oldLayer?: number
}

interface SwitchOperation {
  op: "switch"
  segmentId: string
  point1Index: number
  point2Index: number
}

interface CombinedOperation {
  op: "combined"
  subOperations: Array<SwitchOperation | ChangeLayerOperation>
}

type Operation = ChangeLayerOperation | SwitchOperation | CombinedOperation

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
  lastCreatedOperation: Operation | null = null

  currentNodeCosts: Map<CapacityMeshNodeId, number>

  currentCost: number
  randomSeed: number
  numNodes: number

  probabilityOfFailure: number

  MAX_OPERATIONS_PER_MUTATION = 5
  MAX_NODES_PER_MUTATION = 2

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
    this.MAX_ITERATIONS = 500_000

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

    this.numNodes = this.segmentIdToNodeIds.size
    const { cost, nodeCosts, probabilityOfFailure } = this.computeCurrentCost()
    this.currentCost = cost
    this.currentNodeCosts = nodeCosts
    this.probabilityOfFailure = probabilityOfFailure

    this.randomSeed = 1
    this.allSegmentIds = Array.from(this.currentMutatedSegments.keys())
  }

  random() {
    this.randomSeed = (this.randomSeed * 16807) % 2147483647 // A simple linear congruential generator (LCG)
    return (this.randomSeed - 1) / 2147483646
  }

  /**
   * The cost is the "probability of failure" of the node.
   */
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

    const points = segments.flatMap((s) => s.assignedPoints!)

    if (points.length <= 2) {
      if (points.length <= 1) return 0
      // anything that requires a via has a very small chance of failure
      return 0
      // return points[0].point.z !== points[1].point.z ? 0.01 : 0
    }

    const {
      numEntryExitLayerChanges,
      numSameLayerCrossings,
      numTransitionPairCrossings,
    } = getIntraNodeCrossingsFromSegments(segments)

    const estNumVias =
      numSameLayerCrossings * 0.82 +
      numEntryExitLayerChanges * 0.5 +
      numTransitionPairCrossings * 0.5

    const estUsedCapacity = (estNumVias / 2) ** 1.1

    return estUsedCapacity
  }

  getRandomWeightedNodeId(): CapacityMeshNodeId {
    const nodeIdsWithCosts = [...this.currentNodeCosts.entries()]
      .filter(([nodeId, cost]) => cost > 0.00001)
      .filter(([nodeId]) => !this.nodeMap.get(nodeId)?._containsTarget)

    if (nodeIdsWithCosts.length === 0) {
      console.error(
        "No nodes with cost > 0.00001 (why are you even running this solver)",
      )
      return this.currentNodeCosts.keys().next().value!
    }

    const totalCost = nodeIdsWithCosts.reduce((acc, [, cost]) => acc + cost, 0)
    const randomValue = this.random() * totalCost
    let cumulativeCost = 0
    for (let i = 0; i < nodeIdsWithCosts.length; i++) {
      const [nodeId, cost] = nodeIdsWithCosts[i]
      cumulativeCost += cost
      if (cumulativeCost >= randomValue) {
        return nodeId
      }
    }
    throw new Error("RANDOM SELECTION FAILURE FOR NODES (this is a bug)")
  }

  getRandomWeightedSegmentId(): string {
    const nodeId = this.getRandomWeightedNodeId()
    const segmentsIds = this.nodeIdToSegmentIds
      .get(nodeId)!
      .filter((s) => this.isSegmentMutable(s))
    return segmentsIds[Math.floor(this.random() * segmentsIds.length)]
  }

  isSegmentMutable(segmentId: string) {
    const segment = this.currentMutatedSegments.get(segmentId)!
    const nodes = this.segmentIdToNodeIds.get(segmentId)!
    return nodes.every((nodeId) => !this.nodeMap.get(nodeId)?._containsTarget)
  }

  getRandomOperationForSegment(
    randomSegmentId: string,
  ): SwitchOperation | ChangeLayerOperation {
    const segment = this.currentMutatedSegments.get(randomSegmentId)!

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

  getNodesNearNode(nodeId: CapacityMeshNodeId, hops = 1): CapacityMeshNodeId[] {
    if (hops === 0) return [nodeId]
    const segments = this.nodeIdToSegmentIds.get(nodeId)!
    const nodes = new Set<CapacityMeshNodeId>()
    for (const segmentId of segments) {
      const adjacentNodeIds = this.segmentIdToNodeIds.get(segmentId)!
      for (const adjacentNodeId of adjacentNodeIds) {
        const ancestors = this.getNodesNearNode(adjacentNodeId, hops - 1)
        for (const ancestor of ancestors) {
          nodes.add(ancestor)
        }
      }
    }
    return Array.from(nodes)
  }

  getRandomCombinedOperationNearNode(
    nodeId: CapacityMeshNodeId,
  ): CombinedOperation {
    const adjacentNodeIds = this.getNodesNearNode(
      nodeId,
      this.MAX_NODES_PER_MUTATION,
    )
    const subOperations: Array<SwitchOperation | ChangeLayerOperation> = []
    const adjacentSegments = adjacentNodeIds
      .flatMap((nodeId) => this.nodeIdToSegmentIds.get(nodeId)!)
      .filter((s) => this.isSegmentMutable(s))
    const numOperations =
      Math.floor(this.random() * this.MAX_OPERATIONS_PER_MUTATION) + 1
    for (let i = 0; i < numOperations; i++) {
      const randomSegmentId =
        adjacentSegments[Math.floor(this.random() * adjacentSegments.length)]
      subOperations.push(this.getRandomOperationForSegment(randomSegmentId))
    }

    return {
      op: "combined",
      subOperations,
    } as CombinedOperation
  }

  /**
   * A combined operation can perform multiple operations on a single node, this
   * allows it to reach outcomes that may not be beneficial with since
   * operations
   */
  getRandomCombinedOperationOnSingleNode(max = 7): CombinedOperation {
    const numSubOperations = max === 1 ? 1 : Math.floor(this.random() * max) + 1
    const subOperations: Array<SwitchOperation | ChangeLayerOperation> = []
    const nodeId = this.getRandomWeightedNodeId()
    const segmentsIds = this.nodeIdToSegmentIds
      .get(nodeId)!
      .filter((s) => this.isSegmentMutable(s))
    for (let i = 0; i < numSubOperations; i++) {
      const randomSegmentId =
        segmentsIds[Math.floor(this.random() * segmentsIds.length)]
      subOperations.push(this.getRandomOperationForSegment(randomSegmentId))
    }
    return {
      op: "combined",
      subOperations,
    } as CombinedOperation
  }

  getRandomOperation(): Operation {
    const randomSegmentId = this.getRandomWeightedSegmentId()

    return this.getRandomOperationForSegment(randomSegmentId)
  }

  /**
   * We compute "overall probability of failure" as our overall cost, then
   * linearize it to make it easier to work with
   */
  computeCurrentCost(): {
    cost: number
    nodeCosts: Map<CapacityMeshNodeId, number>
    probabilityOfFailure: number
  } {
    // let costSum = 0
    let probabilityOfSuccess = 1
    const nodeCosts: Map<CapacityMeshNodeId, number> = new Map()
    for (const nodeId of this.nodeIdToSegmentIds.keys()) {
      const nodeProbOfFailure = this.computeNodeCost(nodeId)
      nodeCosts.set(nodeId, nodeProbOfFailure)
      // costSum += nodeProbOfFailure
      // probability of success *= (1 - probability of failure)
      probabilityOfSuccess *= 1 - nodeProbOfFailure
    }
    const probabilityOfFailure = 1 - probabilityOfSuccess

    // linearize the cost to make it easier to work with
    // const numEvents = this.numNodes
    // const linearizedProbOfFailure = probabilityOfFailure / 0.99 ** numEvents

    return { cost: probabilityOfFailure, nodeCosts, probabilityOfFailure }
  }

  applyOperation(op: Operation) {
    if (op.op === "combined") {
      for (const subOp of op.subOperations) {
        this.applyOperation(subOp)
      }
      return
    }

    const segment = this.currentMutatedSegments.get(op.segmentId)!
    if (!segment || !segment.assignedPoints) return
    if (op.op === "changeLayer") {
      // Save original layer in the operation object to allow reversal
      op.oldLayer = segment.assignedPoints[op.pointIndex].point.z
      segment.assignedPoints[op.pointIndex].point.z = op.newLayer
    } else if (op.op === "switch") {
      const point1 = segment.assignedPoints[op.point1Index].point
      const point2 = segment.assignedPoints[op.point2Index].point
      const tempX = point1.x
      const tempY = point1.y
      const tempZ = point1.z
      point1.x = point2.x
      point1.y = point2.y
      point1.z = point2.z
      point2.x = tempX
      point2.y = tempY
      point2.z = tempZ
    }
  }

  reverseOperation(op: Operation) {
    if (op.op === "combined") {
      for (const subOp of [...op.subOperations].reverse()) {
        this.reverseOperation(subOp)
      }
      return
    }

    const segment = this.currentMutatedSegments.get(op.segmentId)
    if (!segment || !segment.assignedPoints) return
    if (op.op === "changeLayer") {
      const oldLayer = op.oldLayer
      if (oldLayer === undefined) return
      segment.assignedPoints[op.pointIndex].point.z = oldLayer
    } else if (op.op === "switch") {
      // Reversing a switch is simply swapping the points back
      const point1 = segment.assignedPoints[op.point1Index].point
      const point2 = segment.assignedPoints[op.point2Index].point
      const tempX = point1.x
      const tempY = point1.y
      const tempZ = point1.z
      point1.x = point2.x
      point1.y = point2.y
      point1.z = point2.z
      point2.x = tempX
      point2.y = tempY
      point2.z = tempZ
    }
  }

  isNewCostAcceptable(oldPf: number, newPf: number) {
    // const INITIAL_TEMPERATURE = 0.01
    // const FINAL_TEMPERATURE = 0.000001
    // const COOLING_RATE =
    //   (FINAL_TEMPERATURE / INITIAL_TEMPERATURE) ** (1 / this.MAX_ITERATIONS)

    // Calculate current temperature based on iteration
    // const temperature = INITIAL_TEMPERATURE * COOLING_RATE ** this.iterations

    // If new cost is better, accept it
    if (newPf < oldPf) return true
    return false

    // const probDelta = newPf - oldPf
    // TODO we could use the probability delta to determine if this is a big
    // mistake

    // return this.random() < temperature
  }

  _step() {
    if (this.iterations === this.MAX_ITERATIONS - 1) {
      this.solved = true
    }
    // const op = this.getRandomCombinedOperationOnSingleNode()
    const op = this.getRandomCombinedOperationNearNode(
      this.getRandomWeightedNodeId(),
    )
    this.lastCreatedOperation = op
    this.applyOperation(op)
    const {
      cost: newCost,
      nodeCosts: newNodeCosts,
      probabilityOfFailure: newProbabilityOfFailure,
    } = this.computeCurrentCost()

    // TODO determine if we should keep the new state
    const keepChange = this.isNewCostAcceptable(this.currentCost, newCost)

    if (!keepChange) {
      this.reverseOperation(op)
      return
    }

    this.currentCost = newCost
    this.currentNodeCosts = newNodeCosts
    this.lastAppliedOperation = op
    this.probabilityOfFailure = newProbabilityOfFailure
  }

  visualize(): GraphicsObject {
    const immutableSegments = new Set(
      [...this.currentMutatedSegments.values()].filter(
        (seg) => !this.isSegmentMutable(seg.nodePortSegmentId!),
      ),
    )
    const graphics: Required<GraphicsObject> = {
      points: [...this.currentMutatedSegments.values()].flatMap((seg, i) =>
        seg.assignedPoints!.map((ap) => ({
          x: ap.point.x,
          y: ap.point.y,
          label: `${seg.nodePortSegmentId}\nlayer: ${ap.point.z}\n${immutableSegments.has(seg) ? "IMMUTABLE" : ""}`,
          color: this.colorMap[ap.connectionName],
        })),
      ),
      lines: [...this.currentMutatedSegments.values()].map((seg) => ({
        points: [seg.start, seg.end],
      })),
      rects: [
        ...[...this.nodeMap.values()].map((node) => {
          const segmentIds = this.nodeIdToSegmentIds.get(
            node.capacityMeshNodeId,
          )!
          const segments = segmentIds.map(
            (segmentId) => this.currentMutatedSegments.get(segmentId)!,
          )!
          const intraNodeCrossings = getIntraNodeCrossingsFromSegments(segments)
          return {
            center: node.center,
            label: `${node.capacityMeshNodeId}\n${this.computeNodeCost(node.capacityMeshNodeId)}\nX'ings: ${intraNodeCrossings.numSameLayerCrossings}\nEnt/Ex LC: ${intraNodeCrossings.numEntryExitLayerChanges}\nT X'ings: ${intraNodeCrossings.numTransitionPairCrossings}`,
            color: "red",
            width: node.width / 8,
            height: node.height / 8,
          } as Rect
        }),
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
      Record<string, { x: number; y: number; z: number }[]>
    > = {}
    for (const seg of this.currentMutatedSegments.values()) {
      const nodeIds = this.segmentIdToNodeIds.get(seg.nodePortSegmentId!)!
      for (const nodeId of nodeIds) {
        if (!nodeConnections[nodeId]) {
          nodeConnections[nodeId] = {}
        }
        for (const ap of seg.assignedPoints!) {
          if (!nodeConnections[nodeId][ap.connectionName]) {
            nodeConnections[nodeId][ap.connectionName] = []
          }
          nodeConnections[nodeId][ap.connectionName].push(ap.point)
        }
      }
    }
    for (const nodeId in nodeConnections) {
      for (const conn in nodeConnections[nodeId]) {
        const points = nodeConnections[nodeId][conn]
        if (points.length <= 1) continue

        const sameLayer = points[0].z === points[1].z
        const commonLayer = points[0].z

        const type = sameLayer
          ? commonLayer === 0
            ? "top"
            : "bottom"
          : "transition"

        dashedLines.push({
          points,
          strokeDash:
            type === "top" ? undefined : type === "bottom" ? "10 5" : "3 3 10",
          strokeColor: this.colorMap[conn] || "#000",
        } as Line)
      }
    }
    graphics.lines.push(...(dashedLines as any))

    // Add visualization for the last applied operation
    const operationsToShow: (SwitchOperation | ChangeLayerOperation)[] = []
    if (this.lastCreatedOperation?.op === "combined") {
      operationsToShow.push(...this.lastCreatedOperation.subOperations)
    } else if (this.lastCreatedOperation) {
      operationsToShow.push(this.lastCreatedOperation)
    }

    for (const op of operationsToShow) {
      const segment = this.currentMutatedSegments.get(op.segmentId)!
      const node = this.nodeMap.get(segment.capacityMeshNodeId)!
      // Create a circle around the node
      graphics.circles.push({
        center: { x: node.center.x, y: node.center.y },
        radius: node.width / 4,
        stroke: "#0000ff",
        fill: "rgba(0, 0, 255, 0.2)",
        label: `LAST OPERATION: ${op.op}\n${node.capacityMeshNodeId}\n${this.currentNodeCosts.get(node.capacityMeshNodeId)}`,
      })

      // For both operation types, we'll highlight the affected points
      if (op.op === "changeLayer") {
        const point = segment.assignedPoints![op.pointIndex]
        graphics.circles.push({
          center: { x: point.point.x, y: point.point.y },
          radius: this.nodeMap.get(segment.capacityMeshNodeId)!.width / 8,
          stroke: "#ff0000",
          fill: "rgba(255, 0, 0, 0.2)",
          label: `Layer Changed\noldLayer: ${op.oldLayer}\nnewLayer: ${op.newLayer}`,
        })
      } else if (op.op === "switch") {
        // For switch operations, highlight both points that were swapped
        const point1 = segment.assignedPoints![op.point1Index]
        const point2 = segment.assignedPoints![op.point2Index]

        // Add circles around both swapped points
        graphics.circles.push(
          {
            center: { x: point1.point.x, y: point1.point.y },
            radius: node.width / 16,
            stroke: "#00ff00",
            fill: "rgba(0, 255, 0, 0.2)",
            label: `Swapped 1\n${segment.nodePortSegmentId!}`,
          },
          {
            center: { x: point2.point.x, y: point2.point.y },
            radius: node.width / 16,
            stroke: "#00ff00",
            fill: "rgba(0, 255, 0, 0.2)",
            label: `Swapped 2\n${segment.nodePortSegmentId!}`,
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
          strokeWidth: node.width / 32,
        })
      }
    }

    return graphics
  }
}
