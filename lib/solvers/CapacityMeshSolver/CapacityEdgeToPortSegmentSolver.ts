import type { GraphicsObject } from "graphics-debug"
import type {
  CapacityMeshEdge,
  CapacityMeshNode,
  CapacityMeshNodeId,
  CapacityPath,
} from "../../types"
import type { NodePortSegment } from "../../types/capacity-edges-to-port-segments-types"
import { BaseSolver } from "../BaseSolver"
import { getNodeEdgeMap } from "./getNodeEdgeMap"
import { safeTransparentize } from "../colors"

/**
 * Each Node is a square. The capacity paths indicate the nodes the trace will
 * travel through. We want to find the "Port Segment" that each capacity path
 * will take for each node.
 */
export class CapacityEdgeToPortSegmentSolver extends BaseSolver {
  nodes: CapacityMeshNode[]
  edges: CapacityMeshEdge[]
  capacityPaths: CapacityPath[]

  nodeMap: Map<CapacityMeshNodeId, CapacityMeshNode>
  nodeEdgeMap: Map<CapacityMeshNodeId, CapacityMeshEdge[]>

  unprocessedNodeIds: CapacityMeshNodeId[]

  nodePortSegments: Map<CapacityMeshNodeId, NodePortSegment[]>
  colorMap: Record<string, string>

  constructor({
    nodes,
    edges,
    capacityPaths,
    colorMap,
  }: {
    nodes: CapacityMeshNode[]
    edges: CapacityMeshEdge[]
    capacityPaths: CapacityPath[]
    colorMap?: Record<string, string>
  }) {
    super()
    this.nodes = nodes
    this.edges = edges
    this.nodeMap = new Map(nodes.map((node) => [node.capacityMeshNodeId, node]))
    this.nodeEdgeMap = getNodeEdgeMap(edges)
    this.capacityPaths = capacityPaths
    this.colorMap = colorMap ?? {}

    // We will be evaluating capacity paths
    this.unprocessedNodeIds = [
      ...new Set(capacityPaths.flatMap((path) => path.nodeIds)),
    ]
    this.nodePortSegments = new Map()
  }

  step() {
    const nodeId = this.unprocessedNodeIds.pop()
    if (!nodeId) {
      this.solved = true
      return
    }

    const pathsGoingThroughNode: Array<{
      path: CapacityPath
      indexOfNodeInPath: number
    }> = []
    for (const path of this.capacityPaths) {
      const indexOfNodeInPath = path.nodeIds.indexOf(nodeId)
      if (indexOfNodeInPath !== -1) {
        pathsGoingThroughNode.push({ path, indexOfNodeInPath })
      }
    }

    const node = this.nodeMap.get(nodeId)!
    const nodePortSegments: NodePortSegment[] = []

    for (const { path, indexOfNodeInPath } of pathsGoingThroughNode) {
      const entryNodeId = path.nodeIds[indexOfNodeInPath - 1]
      const exitNodeId = path.nodeIds[indexOfNodeInPath + 1]

      for (const adjNodeId of [entryNodeId, exitNodeId]) {
        const adjNode = this.nodeMap.get(adjNodeId)!
        if (!adjNode) continue
        const segment = findOverlappingSegment(node, adjNode)

        const portSegment: NodePortSegment = {
          capacityMeshNodeId: nodeId,
          start: segment.start,
          end: segment.end,
          connectionNames: [path.connectionName],
        }

        nodePortSegments.push(portSegment)
      }
    }

    // Combine overlapping or adjacent segments on the same edge.
    const combinedSegments = combineSegments(nodePortSegments)
    this.nodePortSegments.set(nodeId, combinedSegments)
  }

  visualize(): GraphicsObject {
    const graphics: GraphicsObject = {
      lines: [],
      points: [],
      rects: [],
      circles: [],
    }
    this.nodePortSegments.forEach((segments, nodeId) => {
      const node = this.nodeMap.get(nodeId)!
      segments.forEach((segment) => {
        const isVertical = segment.start.x === segment.end.x
        const THICKNESS = 0.5 / segment.connectionNames.length
        for (let i = 0; i < segment.connectionNames.length; i++) {
          const offsetAmount =
            (i / (segment.connectionNames.length - 1 + 0.000001) - 0.5) *
            THICKNESS
          const offset = {
            x: isVertical ? offsetAmount : 0,
            y: isVertical ? 0 : offsetAmount,
          }
          const trueSegmentCenter = {
            x: (segment.start.x + segment.end.x) / 2 + offset.x,
            y: (segment.start.y + segment.end.y) / 2 + offset.y,
          }
          graphics.rects!.push({
            center: {
              x: (trueSegmentCenter.x * 6 + node.center.x) / 7,
              y: (trueSegmentCenter.y * 6 + node.center.y) / 7,
            },
            width: isVertical
              ? THICKNESS
              : Math.abs(segment.end.x - segment.start.x),
            height: isVertical
              ? Math.abs(segment.end.y - segment.start.y)
              : THICKNESS,
            fill: safeTransparentize(
              this.colorMap[segment.connectionNames[i]],
              0.6,
            ),
            label: `${nodeId}: ${segment.connectionNames.join(", ")}`,
          })
        }
      })
    })
    return graphics
  }
}

function findOverlappingSegment(
  node: CapacityMeshNode,
  adjNode: CapacityMeshNode,
): { start: { x: number; y: number }; end: { x: number; y: number } } {
  // Find overlapping ranges in x and y dimensions
  const xOverlap = {
    start: Math.max(
      node.center.x - node.width / 2,
      adjNode.center.x - adjNode.width / 2,
    ),
    end: Math.min(
      node.center.x + node.width / 2,
      adjNode.center.x + adjNode.width / 2,
    ),
  }

  const yOverlap = {
    start: Math.max(
      node.center.y - node.height / 2,
      adjNode.center.y - adjNode.height / 2,
    ),
    end: Math.min(
      node.center.y + node.height / 2,
      adjNode.center.y + adjNode.height / 2,
    ),
  }

  const xRange = xOverlap.end - xOverlap.start
  const yRange = yOverlap.end - yOverlap.start

  // If the x-range is smaller then the nodes touch vertically (common vertical edge).
  if (xRange < yRange) {
    // They are horizontally adjacent: shared vertical edge.
    const x = (xOverlap.start + xOverlap.end) / 2
    return {
      start: { x, y: yOverlap.start },
      end: { x, y: yOverlap.end },
    }
  } else {
    // Otherwise, they are vertically adjacent: shared horizontal edge.
    const y = (yOverlap.start + yOverlap.end) / 2
    return {
      start: { x: xOverlap.start, y },
      end: { x: xOverlap.end, y },
    }
  }
}

/**
 * Given a list of segments on a node, merge segments that are overlapping
 */
function combineSegments(segments: NodePortSegment[]): NodePortSegment[] {
  const mergedSegments: NodePortSegment[] = []
  const remainingSegments = [...segments]
  while (remainingSegments.length > 0) {
    const segmentUnderTest = remainingSegments.pop()!
    const overlappingMergedSegment = mergedSegments.find((segment) => {
      return (
        segment.start.x === segmentUnderTest.start.x &&
        segment.start.y === segmentUnderTest.start.y &&
        segment.end.x === segmentUnderTest.end.x &&
        segment.end.y === segmentUnderTest.end.y
      )
    })
    if (overlappingMergedSegment) {
      overlappingMergedSegment.connectionNames.push(
        ...segmentUnderTest.connectionNames,
      )
    } else {
      mergedSegments.push(segmentUnderTest)
    }
  }
  return mergedSegments
}
