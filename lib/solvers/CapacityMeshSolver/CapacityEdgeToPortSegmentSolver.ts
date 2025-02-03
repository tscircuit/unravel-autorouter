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

  constructor({
    nodes,
    edges,
    capacityPaths,
  }: {
    nodes: CapacityMeshNode[]
    edges: CapacityMeshEdge[]
    capacityPaths: CapacityPath[]
  }) {
    super()
    this.nodes = nodes
    this.edges = edges
    this.nodeMap = new Map(nodes.map((node) => [node.capacityMeshNodeId, node]))
    this.nodeEdgeMap = getNodeEdgeMap(edges)
    this.capacityPaths = capacityPaths

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

    // TODO Combine segments

    this.nodePortSegments.set(nodeId, nodePortSegments)
  }

  visualize(): GraphicsObject {
    const graphics: GraphicsObject = {
      lines: [],
      points: [],
      rects: [],
      circles: [],
    }
    this.nodePortSegments.forEach((segments, nodeId) => {
      segments.forEach((segment) => {
        const isVertical = segment.start.x === segment.end.x
        const THICKNESS = 0.75
        graphics.rects!.push({
          center: {
            x: (segment.start.x + segment.end.x) / 2,
            y: (segment.start.y + segment.end.y) / 2,
          },
          width: isVertical
            ? THICKNESS
            : Math.abs(segment.end.x - segment.start.x),
          height: isVertical
            ? Math.abs(segment.end.y - segment.start.y)
            : THICKNESS,
          label: `${nodeId}: ${segment.connectionNames.join(", ")}`,
        })
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
