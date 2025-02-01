import type { GraphicsObject } from "graphics-debug"
import { BaseSolver } from "./BaseSolver"
import type {
  CapacityMeshEdge,
  CapacityMeshNode,
  SimpleRouteJson,
} from "../types"
import { COLORS } from "./colors"

export class CapacityMeshSolver extends BaseSolver {
  unfinishedNodes: CapacityMeshNode[]
  finishedNodes: CapacityMeshNode[]
  edges: CapacityMeshEdge[]

  MAX_DEPTH = 4

  constructor(public srj: SimpleRouteJson) {
    super()
    const boundsCenter = {
      x: (srj.bounds.minX + srj.bounds.maxX) / 2,
      y: (srj.bounds.minY + srj.bounds.maxY) / 2,
    }
    const boundsSize = {
      width: srj.bounds.maxX - srj.bounds.minX,
      height: srj.bounds.maxY - srj.bounds.minY,
    }
    this.unfinishedNodes = [
      {
        capacityMeshNodeId: this.getNextNodeId(),
        center: boundsCenter,
        width: boundsSize.width,
        height: boundsSize.height,
        layer: "top",
        totalCapacity: this.getCapacityFromDepth(0),
        _depth: 0,
      },
    ]
    this.finishedNodes = []
    this.edges = []
  }

  _nextNodeCounter = 0
  getNextNodeId(): string {
    return `cn${this._nextNodeCounter++}`
  }

  getCapacityFromDepth(depth: number): number {
    return (this.MAX_DEPTH - depth) ** 2
  }

  doesNodeContainTarget(node: CapacityMeshNode) {
    const targets = this.srj.connections.flatMap((c) => c.pointsToConnect)
    for (const target of targets) {
      if (target.layer !== node.layer) continue
      if (
        target.x >= node.center.x - node.width / 2 &&
        target.x <= node.center.x + node.width / 2 &&
        target.y >= node.center.y - node.height / 2 &&
        target.y <= node.center.y + node.height / 2
      ) {
        return true
      }
    }
    return false
  }

  /**
   * Checks if the given mesh node overlaps with any obstacle.
   * We treat both obstacles and nodes as axis‐aligned rectangles.
   */
  doesNodeContainObstacle(node: CapacityMeshNode): boolean {
    const obstacles = this.srj.obstacles
    // Compute node bounds
    const nodeLeft = node.center.x - node.width / 2
    const nodeRight = node.center.x + node.width / 2
    const nodeTop = node.center.y - node.height / 2
    const nodeBottom = node.center.y + node.height / 2

    for (const obstacle of obstacles) {
      const obsLeft = obstacle.center.x - obstacle.width / 2
      const obsRight = obstacle.center.x + obstacle.width / 2
      const obsTop = obstacle.center.y - obstacle.height / 2
      const obsBottom = obstacle.center.y + obstacle.height / 2

      // Check for intersection.
      if (
        nodeRight >= obsLeft &&
        nodeLeft <= obsRight &&
        nodeBottom >= obsTop &&
        nodeTop <= obsBottom
      ) {
        return true
      }
    }
    return false
  }

  /**
   * Checks if the entire node is contained within any obstacle.
   */
  isNodeCompletelyInsideObstacle(node: CapacityMeshNode): boolean {
    const obstacles = this.srj.obstacles
    // Compute node bounds
    const nodeLeft = node.center.x - node.width / 2
    const nodeRight = node.center.x + node.width / 2
    const nodeTop = node.center.y - node.height / 2
    const nodeBottom = node.center.y + node.height / 2

    for (const obstacle of obstacles) {
      const obsLeft = obstacle.center.x - obstacle.width / 2
      const obsRight = obstacle.center.x + obstacle.width / 2
      const obsTop = obstacle.center.y - obstacle.height / 2
      const obsBottom = obstacle.center.y + obstacle.height / 2

      // Check if the node's bounds are completely inside the obstacle's bounds.
      if (
        nodeLeft >= obsLeft &&
        nodeRight <= obsRight &&
        nodeTop >= obsTop &&
        nodeBottom <= obsBottom
      ) {
        return true
      }
    }
    return false
  }

  getChildNodes(parent: CapacityMeshNode): CapacityMeshNode[] {
    if (parent._depth === this.MAX_DEPTH) return []
    const childNodes: CapacityMeshNode[] = []

    const childNodeSize = { width: parent.width / 2, height: parent.height / 2 }

    const childNodePositions = [
      {
        x: parent.center.x - childNodeSize.width / 2,
        y: parent.center.y - childNodeSize.height / 2,
      },
      {
        x: parent.center.x + childNodeSize.width / 2,
        y: parent.center.y - childNodeSize.height / 2,
      },
      {
        x: parent.center.x - childNodeSize.width / 2,
        y: parent.center.y + childNodeSize.height / 2,
      },
      {
        x: parent.center.x + childNodeSize.width / 2,
        y: parent.center.y + childNodeSize.height / 2,
      },
    ]

    for (const position of childNodePositions) {
      const childNode: CapacityMeshNode = {
        capacityMeshNodeId: this.getNextNodeId(),
        center: position,
        width: childNodeSize.width,
        height: childNodeSize.height,
        layer: parent.layer,
        totalCapacity: this.getCapacityFromDepth((parent._depth ?? 0) + 1),
        _depth: (parent._depth ?? 0) + 1,
        _parent: parent,
      }
      childNode._containsTarget = this.doesNodeContainTarget(childNode)
      childNode._containsObstacle = this.doesNodeContainObstacle(childNode)
      if (childNode._containsObstacle) {
        childNode._completelyInsideObstacle =
          this.isNodeCompletelyInsideObstacle(childNode)
      }
      if (childNode._completelyInsideObstacle) continue
      childNodes.push(childNode)
    }

    return childNodes
  }

  shouldNodeBeSubdivided(node: CapacityMeshNode) {
    return (
      node._depth !== this.MAX_DEPTH &&
      (node._containsObstacle || node._containsTarget) &&
      !node._completelyInsideObstacle
    )
  }

  step() {
    const nextNode = this.unfinishedNodes.pop()
    if (!nextNode) {
      this.solved = true
      return
    }

    const newNodes = this.getChildNodes(nextNode)

    const finishedNewNodes: CapacityMeshNode[] = []
    const unfinishedNewNodes: CapacityMeshNode[] = []

    for (const newNode of newNodes) {
      const shouldBeSubdivided = this.shouldNodeBeSubdivided(newNode)
      if (shouldBeSubdivided) {
        unfinishedNewNodes.push(newNode)
      } else if (!shouldBeSubdivided && !newNode._containsObstacle) {
        finishedNewNodes.push(newNode)
      }
    }

    this.unfinishedNodes.push(...unfinishedNewNodes)
    this.finishedNodes.push(...finishedNewNodes)
  }

  /**
   * Creates a GraphicsObject to visualize the mesh, its nodes, obstacles, and connection points.
   *
   * - Mesh nodes are rendered as rectangles.
   *   - Nodes that have an obstacle intersection are outlined in red.
   *   - Other nodes are outlined in green.
   * - Lines are drawn from a node to its parent.
   * - Obstacles are drawn as semi-transparent red rectangles.
   * - Points for each connection’s pointsToConnect are drawn in a unique color.
   */
  visualize(): GraphicsObject {
    const graphics: GraphicsObject = {
      lines: [],
      points: [],
      rects: [],
      circles: [],
      coordinateSystem: "cartesian",
      title: "Capacity Mesh Visualization",
    }

    // Draw mesh nodes (both finished and unfinished)
    const allNodes = [...this.finishedNodes, ...this.unfinishedNodes]
    for (const node of allNodes) {
      graphics.rects!.push({
        center: node.center,
        width: node.width - 2,
        height: node.height - 2,
        fill: node._containsObstacle ? "rgba(255,0,0,0.1)" : "rgba(0,0,0,0.1)",
        label: node.capacityMeshNodeId,
      })
    }

    // Draw obstacles
    for (const obstacle of this.srj.obstacles) {
      graphics.rects!.push({
        center: obstacle.center,
        width: obstacle.width,
        height: obstacle.height,
        fill: "rgba(255,0,0,0.3)",
        stroke: "red",
        label: "obstacle",
      })
    }

    // Draw connection points (each connection gets a unique color).
    this.srj.connections.forEach((connection, index) => {
      const color = COLORS[index % COLORS.length]
      for (const pt of connection.pointsToConnect) {
        graphics.points!.push({
          x: pt.x,
          y: pt.y,
          label: `conn-${index}`,
          color,
        })
      }
    })

    return graphics
  }
}
