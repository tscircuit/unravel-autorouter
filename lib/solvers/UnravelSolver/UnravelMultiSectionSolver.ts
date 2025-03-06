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
  SegmentPoint,
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

    const graphics: Required<GraphicsObject> = {
      lines: [],
      points: [],
      rects: [],
      circles: [],
      coordinateSystem: "cartesian",
      title: "Unravel Multi Section Solver",
    }

    // Visualize nodes
    for (const [nodeId, node] of this.nodeMap.entries()) {
      const probabilityOfFailure = this.nodePfMap.get(nodeId) || 0
      // Color based on probability of failure - red for high, gradient to green for low
      const pf = Math.min(probabilityOfFailure, 1) // Cap at 1
      const red = Math.floor(255 * pf)
      const green = Math.floor(255 * (1 - pf))
      const color = `rgb(${red}, ${green}, 0)`

      graphics.rects.push({
        center: node.center,
        label: `${nodeId}\n${node.width.toFixed(2)}x${node.height.toFixed(2)}\nPf: ${probabilityOfFailure.toFixed(3)}`,
        color,
        width: node.width / 8,
        height: node.height / 8,
      })
    }

    // Visualize segment points
    for (const segmentPoint of this.segmentPointMap.values()) {
      graphics.points.push({
        x: segmentPoint.x,
        y: segmentPoint.y,
        label: `${segmentPoint.segmentPointId}\nSegment: ${segmentPoint.segmentId}\nLayer: ${segmentPoint.z}`,
        color: this.colorMap[segmentPoint.segmentId] || "#000",
      })
    }

    // Connect segment points that belong to the same segment
    // Group points by segment ID
    const pointsBySegment = new Map<string, SegmentPoint[]>()
    for (const point of this.segmentPointMap.values()) {
      if (!pointsBySegment.has(point.segmentId)) {
        pointsBySegment.set(point.segmentId, [])
      }
      pointsBySegment.get(point.segmentId)!.push(point)
    }

    // Connect points in each segment
    for (const [segmentId, points] of pointsBySegment.entries()) {
      if (points.length < 2) continue

      // Sort points by some logical order (this approximates the correct ordering)
      const sortedPoints = [...points].sort((a, b) =>
        a.x !== b.x ? a.x - b.x : a.y - b.y,
      )

      // Connect adjacent points in the sorted order
      for (let i = 0; i < sortedPoints.length - 1; i++) {
        graphics.lines.push({
          points: [
            { x: sortedPoints[i].x, y: sortedPoints[i].y },
            { x: sortedPoints[i + 1].x, y: sortedPoints[i + 1].y },
          ],
          strokeColor: this.colorMap[segmentId] || "#000",
        })
      }
    }

    // Connect points with the same connection name that share a node
    const processedConnections = new Set<string>()
    const allPoints = Array.from(this.segmentPointMap.values())

    for (let i = 0; i < allPoints.length; i++) {
      const point1 = allPoints[i]
      for (let j = i + 1; j < allPoints.length; j++) {
        const point2 = allPoints[j]

        // Skip if they have different connection names or are in the same segment
        if (
          point1.connectionName !== point2.connectionName ||
          point1.segmentId === point2.segmentId
        ) {
          continue
        }

        // Check if they share a node
        const hasSharedNode = point1.capacityMeshNodeIds.some((nodeId) =>
          point2.capacityMeshNodeIds.includes(nodeId),
        )

        if (hasSharedNode) {
          const connectionKey = `${point1.segmentPointId}-${point2.segmentPointId}`
          if (processedConnections.has(connectionKey)) continue
          processedConnections.add(connectionKey)

          // Determine line style based on layer (z) values
          const sameLayer = point1.z === point2.z
          const layer = point1.z

          let strokeDash: string | undefined
          if (sameLayer) {
            strokeDash = layer === 0 ? undefined : "10 5" // Solid for layer 0, long dash for other layers
          } else {
            strokeDash = "3 3 10" // Mixed dash for transitions between layers
          }

          graphics.lines.push({
            points: [
              { x: point1.x, y: point1.y },
              { x: point2.x, y: point2.y },
            ],
            strokeDash,
            strokeColor: this.colorMap[point1.connectionName] || "#666",
          })
        }
      }
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
