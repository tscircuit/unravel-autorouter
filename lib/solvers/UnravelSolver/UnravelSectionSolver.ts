import { CapacityMeshNode, CapacityMeshNodeId } from "lib/types"
import { BaseSolver } from "../BaseSolver"
import { SegmentWithAssignedPoints } from "../CapacityMeshSolver/CapacitySegmentToPointSolver"
import {
  UnravelSection,
  UnravelCandidate,
  SegmentPoint,
  SegmentPointId,
  SegmentId,
} from "./types"
import { getNodesNearNode } from "./getNodesNearNode"
import { GraphicsObject } from "graphics-debug"
import { createPointModificationsHash } from "./createPointModificationsHash"
import { getIssuesInSection } from "./getIssuesInSection"

/**
 * The UntangleSectionSolver optimizes a section of connected capacity nodes
 * with their deduplicated segments.
 *
 * The section always has a "root" node. From the root node, MUTABLE_HOPS are
 * taken to reach other nodes that are mutable. One additional hop is taken to
 * have all the impacted nodes in section. So a section is composed of mutable
 * and immutable nodes.
 *
 * The goal of the solver is to perform operations on the mutable nodes of the
 * section to lower the overall cost of the section.
 *
 * The untangle phase will perform "operations" on segments based on "issues"
 *
 * An "issue" is anything that increases the cost of the node:
 * - Anything that causes a via (e.g. layer transition)
 * - Any time two traces cross on the same layer
 *
 * An operation is a change to a segment. There are two main operations:
 * - Change layer
 * - Change point order on segment
 *
 * This solver works by exploring different paths of operations. When an
 * operation is performed, new issues are created. Each path has a cost, and
 * a set of neighbors representing next operations to perform.
 *
 */
export class UnravelSectionSolver extends BaseSolver {
  nodeMap: Map<CapacityMeshNodeId, CapacityMeshNode>
  dedupedSegments: SegmentWithAssignedPoints[]

  MUTABLE_HOPS = 1

  unravelSection: UnravelSection

  candidates: UnravelCandidate[] = []

  lastProcessedCandidate: UnravelCandidate | null = null
  bestCandidate: UnravelCandidate | null = null

  rootNodeId: CapacityMeshNodeId
  nodeIdToSegmentIds: Map<CapacityMeshNodeId, CapacityMeshNodeId[]>
  segmentIdToNodeIds: Map<CapacityMeshNodeId, CapacityMeshNodeId[]>
  colorMap: Record<string, string>

  constructor(params: {
    rootNodeId: CapacityMeshNodeId
    colorMap?: Record<string, string>
    MUTABLE_HOPS?: number
    nodeMap: Map<CapacityMeshNodeId, CapacityMeshNode>
    dedupedSegments: SegmentWithAssignedPoints[]
    nodeIdToSegmentIds: Map<CapacityMeshNodeId, CapacityMeshNodeId[]>
    segmentIdToNodeIds: Map<CapacityMeshNodeId, CapacityMeshNodeId[]>
  }) {
    super()

    this.MUTABLE_HOPS = params.MUTABLE_HOPS ?? this.MUTABLE_HOPS

    this.nodeMap = params.nodeMap
    this.dedupedSegments = params.dedupedSegments
    this.nodeIdToSegmentIds = params.nodeIdToSegmentIds
    this.segmentIdToNodeIds = params.segmentIdToNodeIds
    this.rootNodeId = params.rootNodeId
    this.colorMap = params.colorMap ?? {}
    this.unravelSection = this.createUnravelSection()
    this.candidates = [this.createInitialCandidate()]
  }

  createUnravelSection(): UnravelSection {
    const mutableNodeIds = getNodesNearNode({
      nodeId: this.rootNodeId,
      nodeIdToSegmentIds: this.nodeIdToSegmentIds,
      segmentIdToNodeIds: this.segmentIdToNodeIds,
      hops: this.MUTABLE_HOPS,
    })
    const allNodeIds = getNodesNearNode({
      nodeId: this.rootNodeId,
      nodeIdToSegmentIds: this.nodeIdToSegmentIds,
      segmentIdToNodeIds: this.segmentIdToNodeIds,
      hops: this.MUTABLE_HOPS + 1,
    })
    const immutableNodeIds = Array.from(
      new Set(allNodeIds).difference(new Set(mutableNodeIds)),
    )

    const segmentPoints: SegmentPoint[] = []
    let highestSegmentPointId = 0
    for (const segment of this.dedupedSegments) {
      for (const point of segment.assignedPoints!) {
        segmentPoints.push({
          segmentPointId: `SP${highestSegmentPointId++}`,
          segmentId: segment.nodePortSegmentId!,
          capacityMeshNodeIds: this.segmentIdToNodeIds.get(
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

    const segmentPointsInNode = new Map<CapacityMeshNodeId, SegmentPointId[]>()
    for (const segmentPoint of segmentPoints) {
      for (const nodeId of segmentPoint.capacityMeshNodeIds) {
        segmentPointsInNode.set(nodeId, [
          ...(segmentPointsInNode.get(nodeId) ?? []),
          segmentPoint.segmentPointId,
        ])
      }
    }

    const segmentPointsInSegment = new Map<SegmentId, SegmentPointId[]>()
    for (const segmentPoint of segmentPoints) {
      segmentPointsInSegment.set(segmentPoint.segmentId, [
        ...(segmentPointsInSegment.get(segmentPoint.segmentId) ?? []),
        segmentPoint.segmentPointId,
      ])
    }

    // Second pass: set neighboring segment point ids
    for (let i = 0; i < segmentPoints.length; i++) {
      const A = segmentPoints[i]
      for (let j = i + 1; j < segmentPoints.length; j++) {
        const B = segmentPoints[j]
        if (B.segmentPointId === A.segmentPointId) continue
        if (B.segmentId === A.segmentId) continue
        if (B.connectionName !== A.connectionName) continue
        // If the points share the same capacity node, and share the same
        // connection name, then they're neighbors
        if (
          A.capacityMeshNodeIds.some((nId) =>
            B.capacityMeshNodeIds.includes(nId),
          )
        ) {
          A.directlyConnectedSegmentPointIds.push(B.segmentPointId)
          B.directlyConnectedSegmentPointIds.push(A.segmentPointId)
        }
      }
    }

    const segmentPairsInNode = new Map<
      CapacityMeshNodeId,
      Array<[SegmentPointId, SegmentPointId]>
    >()
    for (const nodeId of allNodeIds) {
      segmentPairsInNode.set(nodeId, [])
    }
    for (const segmentPoint of segmentPoints) {
      for (const nodeId of segmentPoint.capacityMeshNodeIds) {
        const otherSegmentPoints = segmentPointsInNode
          .get(nodeId)!
          .map((spId) => segmentPointMap.get(spId)!)
        for (const otherSegmentPoint of otherSegmentPoints) {
          if (otherSegmentPoint.segmentPointId === segmentPoint.segmentPointId)
            continue
          segmentPairsInNode
            .get(nodeId)!
            .push([
              segmentPoint.segmentPointId,
              otherSegmentPoint.segmentPointId,
            ])
        }
      }
    }

    return {
      allNodeIds,
      mutableNodeIds,
      immutableNodeIds,
      segmentPairsInNode,
      segmentPointMap,
      segmentPointsInNode,
      segmentPointsInSegment,
    }
  }

  createInitialCandidate(): UnravelCandidate {
    const pointModifications = new Map<
      SegmentPointId,
      { x?: number; y?: number; z?: number }
    >()
    return {
      pointModifications,
      issues: getIssuesInSection(
        this.unravelSection,
        this.nodeMap,
        pointModifications,
      ),
      g: 0,
      h: 0,
      f: 0,
      operationsPerformed: 0,
      candidateHash: createPointModificationsHash(pointModifications),
    }
  }

  _step() {}

  visualize(): GraphicsObject {
    const graphics: Required<GraphicsObject> = {
      points: [],
      lines: [],
      rects: [],
      circles: [],
      coordinateSystem: "cartesian",
      title: "Unravel Section Solver",
    }

    // Visualize all segment points
    for (const [segmentPointId, segmentPoint] of this.unravelSection
      .segmentPointMap) {
      graphics.points.push({
        x: segmentPoint.x,
        y: segmentPoint.y,
        label: `${segmentPointId}\nSegment: ${segmentPoint.segmentId}\nLayer: ${segmentPoint.z}`,
        color: this.colorMap[segmentPoint.segmentId] || "#000",
      })
    }

    // Visualize nodes
    for (const nodeId of this.unravelSection.allNodeIds) {
      const node = this.nodeMap.get(nodeId)!
      const isMutable = this.unravelSection.mutableNodeIds.includes(nodeId)

      graphics.rects.push({
        center: node.center,
        label: `${nodeId}\n${node.width.toFixed(2)}x${node.height.toFixed(2)}\n${isMutable ? "MUTABLE" : "IMMUTABLE"}`,
        color: isMutable ? "green" : "red",
        width: node.width / 8,
        height: node.height / 8,
      })
    }

    // Connect segment points that belong to the same segment
    for (const [segmentId, segmentPointIds] of this.unravelSection
      .segmentPointsInSegment) {
      if (segmentPointIds.length <= 1) continue

      const points = segmentPointIds.map(
        (spId) => this.unravelSection.segmentPointMap.get(spId)!,
      )

      // Connect points in order
      for (let i = 0; i < points.length - 1; i++) {
        graphics.lines.push({
          points: [
            { x: points[i].x, y: points[i].y },
            { x: points[i + 1].x, y: points[i + 1].y },
          ],
          strokeColor: this.colorMap[segmentId] || "#000",
        })
      }
    }

    // Connect directly connected segment points (points with the same connection name)
    for (const [segmentPointId, segmentPoint] of this.unravelSection
      .segmentPointMap) {
      for (const connectedPointId of segmentPoint.directlyConnectedSegmentPointIds) {
        // Only process each connection once (when the current point's ID is less than the connected point's ID)
        if (segmentPointId < connectedPointId) {
          const connectedPoint =
            this.unravelSection.segmentPointMap.get(connectedPointId)!

          // Determine line style based on layer (z) values
          const sameLayer = segmentPoint.z === connectedPoint.z
          const commonLayer = segmentPoint.z

          let strokeDash: string | undefined
          if (sameLayer) {
            strokeDash = commonLayer === 0 ? undefined : "10 5" // top layer: solid, bottom layer: long dash
          } else {
            strokeDash = "3 3 10" // transition between layers: mixed dash pattern
          }

          graphics.lines.push({
            points: [
              { x: segmentPoint.x, y: segmentPoint.y },
              { x: connectedPoint.x, y: connectedPoint.y },
            ],
            strokeDash,
            strokeColor: this.colorMap[segmentPoint.connectionName] || "#000",
          })
        }
      }
    }

    // Visualize issues
    if (this.lastProcessedCandidate) {
      for (const issue of this.lastProcessedCandidate.issues) {
        const node = this.nodeMap.get(issue.capacityMeshNodeId)!

        if (issue.type === "transition_via") {
          // Highlight via issues
          for (const segmentPointId of issue.segmentPoints) {
            const segmentPoint =
              this.unravelSection.segmentPointMap.get(segmentPointId)!
            graphics.circles.push({
              center: { x: segmentPoint.x, y: segmentPoint.y },
              radius: node.width / 16,
              stroke: "#ff0000",
              fill: "rgba(255, 0, 0, 0.2)",
              label: `Via Issue\n${segmentPointId}`,
            })
          }
        } else if (issue.type === "same_layer_crossing") {
          // Highlight crossing issues
          for (const [sp1Id, sp2Id] of [
            issue.crossingLine1,
            issue.crossingLine2,
          ]) {
            const sp1 = this.unravelSection.segmentPointMap.get(sp1Id)!
            const sp2 = this.unravelSection.segmentPointMap.get(sp2Id)!

            graphics.lines.push({
              points: [
                { x: sp1.x, y: sp1.y },
                { x: sp2.x, y: sp2.y },
              ],
              strokeColor: "#ff0000",
              strokeDash: "3 3",
              strokeWidth: node.width / 32,
            })
          }
        }
      }

      // Visualize point modifications in the current candidate
      for (const [segmentPointId, modification] of this.lastProcessedCandidate
        .pointModifications) {
        const originalPoint =
          this.unravelSection.segmentPointMap.get(segmentPointId)!
        const x = modification.x ?? originalPoint.x
        const y = modification.y ?? originalPoint.y
        const z = modification.z ?? originalPoint.z

        graphics.circles.push({
          center: { x, y },
          radius: 5,
          stroke: "#0000ff",
          fill: "rgba(0, 0, 255, 0.2)",
          label: `Modified Point\nOriginal: (${originalPoint.x}, ${originalPoint.y}, ${originalPoint.z})\nNew: (${x}, ${y}, ${z})`,
        })
      }
    }

    return graphics
  }
}
