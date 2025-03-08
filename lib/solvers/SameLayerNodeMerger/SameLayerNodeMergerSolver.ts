import { CapacityMeshNode, CapacityMeshNodeId } from "lib/types"
import { BaseSolver } from "../BaseSolver"
import { areNodesBordering } from "lib/utils/areNodesBordering"
import { GraphicsObject } from "graphics-debug"
import { createRectFromCapacityNode } from "lib/utils/createRectFromCapacityNode"

const EPSILON = 0.001

/**
 * Merges same layer nodes into larger nodes. Pre-processing stage necessary
 * for "strawing".
 */
export class SameLayerNodeMergerSolver extends BaseSolver {
  nodeMap: Map<CapacityMeshNodeId, CapacityMeshNode>
  unprocessedNodeIds: CapacityMeshNodeId[]

  processedNodeIds: Set<CapacityMeshNodeId>

  newNodes: CapacityMeshNode[]
  constructor(nodes: CapacityMeshNode[], minCellSize: number) {
    super()
    this.nodeMap = new Map()
    for (const node of nodes) {
      this.nodeMap.set(node.capacityMeshNodeId, node)
    }
    this.newNodes = []
    this.processedNodeIds = new Set()
    const nodeWithArea: Array<[string, number]> = []
    for (const node of nodes) {
      if (node.availableZ.length > 1) {
        this.newNodes.push(node)
        this.processedNodeIds.add(node.capacityMeshNodeId)
      } else {
        nodeWithArea.push([node.capacityMeshNodeId, node.width * node.height])
      }
    }
    nodeWithArea.sort((a, b) => a[1] - b[1])
    this.unprocessedNodeIds = nodeWithArea.map((n) => n[0])
  }

  getAdjacentSameLayerUnprocessedNodes(rootNode: CapacityMeshNode) {
    const adjacentNodes: CapacityMeshNode[] = []
    for (const unprocessedNodeId of this.unprocessedNodeIds) {
      const unprocessedNode = this.nodeMap.get(unprocessedNodeId)!
      if (unprocessedNode.availableZ[0] !== rootNode.availableZ[0]) continue
      if (!areNodesBordering(rootNode, unprocessedNode)) continue
      adjacentNodes.push(unprocessedNode)
    }
    return adjacentNodes
  }

  _step() {
    const rootNodeId = this.unprocessedNodeIds.pop()

    console.log({ rootNodeId })
    if (!rootNodeId) {
      this.solved = true
      return
    }

    if (this.processedNodeIds.has(rootNodeId)) {
      return
    }

    const rootNode = this.nodeMap.get(rootNodeId)!
    let rootNodeHasGrown = false

    const adjacentNodes = this.getAdjacentSameLayerUnprocessedNodes(rootNode)

    if (adjacentNodes.length === 0) {
      this.processedNodeIds.add(rootNodeId)
      this.newNodes.push(rootNode)
      return
    }

    const adjacentNodesToLeft = adjacentNodes.filter(
      (adjNode) =>
        adjNode.center.x < rootNode.center.x &&
        Math.abs(adjNode.center.y - rootNode.center.y) < rootNode.height / 2,
    )

    if (adjacentNodesToLeft.length > 0) {
      const { width: adjNodeWidth, height: adjNodeHeight } =
        adjacentNodesToLeft[0]
      const leftAdjNodesAreAllSameSize = adjacentNodesToLeft.every(
        (adjNode) =>
          adjNode.width === adjNodeWidth && adjNode.height === adjNodeHeight,
      )

      const leftAdjNodesTakeUpEntireHeight =
        Math.abs(
          adjacentNodesToLeft.reduce((acc, adjNode) => {
            return acc + adjNode.height
          }, 0) - rootNode.height,
        ) < EPSILON

      if (leftAdjNodesTakeUpEntireHeight && leftAdjNodesAreAllSameSize) {
        rootNode.width += adjNodeWidth
        rootNode.center.x = rootNode.center.x - adjNodeWidth / 2

        for (const adjNode of adjacentNodesToLeft) {
          this.processedNodeIds.add(adjNode.capacityMeshNodeId)
        }

        rootNodeHasGrown = true
      }
    }

    if (rootNodeHasGrown) {
      this.unprocessedNodeIds.push(rootNodeId)
    } else {
      this.processedNodeIds.add(rootNodeId)
      this.newNodes.push(rootNode)
    }
  }

  visualize(): GraphicsObject {
    const graphics = {
      circles: [],
      lines: [],
      points: [],
      rects: [],
      coordinateSystem: "cartesian",
      title: "Same Layer Node Merger",
    } as Required<GraphicsObject>

    for (const node of this.newNodes) {
      graphics.rects.push(createRectFromCapacityNode(node))
    }

    // Visualize unprocessed nodes with a different style
    for (const nodeId of this.unprocessedNodeIds) {
      const node = this.nodeMap.get(nodeId)
      if (node) {
        const rect = createRectFromCapacityNode(node)
        rect.stroke = "rgba(255, 165, 0, 0.8)" // Orange border
        rect.label = `${rect.label}\n(unprocessed)`
        graphics.rects.push(rect)
      }
    }

    return graphics
  }
}
