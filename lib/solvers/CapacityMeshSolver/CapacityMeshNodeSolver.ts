import type { GraphicsObject } from "graphics-debug"
import { BaseSolver } from "../BaseSolver"
import type {
  CapacityMeshEdge,
  CapacityMeshNode,
  CapacityMeshNodeId,
  Obstacle,
  SimpleRouteJson,
} from "../../types"
import { COLORS } from "../colors"
import { isPointInRect } from "lib/utils/isPointInRect"
import { doRectsOverlap } from "lib/utils/doRectsOverlap"

interface CapacityMeshNodeSolverOptions {
  capacityDepth?: number
}

interface Target {
  x: number
  y: number
  connectionName: string
  availableZ: number[]
}

export class CapacityMeshNodeSolver extends BaseSolver {
  unfinishedNodes: CapacityMeshNode[]
  finishedNodes: CapacityMeshNode[]

  nodeToOverlappingObstaclesMap: Map<CapacityMeshNodeId, Obstacle[]>

  // targetObstacleMap: Record<string, { obstacle: Obstacle, node: CapacityMeshNode }>

  MAX_DEPTH = 4

  targets: Target[]

  constructor(
    public srj: SimpleRouteJson,
    public opts: CapacityMeshNodeSolverOptions = {},
  ) {
    super()
    this.MAX_DEPTH = opts?.capacityDepth ?? this.MAX_DEPTH
    this.MAX_ITERATIONS = 100_000
    const boundsCenter = {
      x: (srj.bounds.minX + srj.bounds.maxX) / 2,
      y: (srj.bounds.minY + srj.bounds.maxY) / 2,
    }
    const boundsSize = {
      width: srj.bounds.maxX - srj.bounds.minX,
      height: srj.bounds.maxY - srj.bounds.minY,
    }
    const maxWidthHeight = Math.max(boundsSize.width, boundsSize.height)
    this.unfinishedNodes = [
      {
        capacityMeshNodeId: this.getNextNodeId(),
        center: boundsCenter,
        width: maxWidthHeight,
        height: maxWidthHeight,
        layer: "top",
        availableZ: [0, 1],
        _depth: 0,
        _containsTarget: true,
        _containsObstacle: true,
        _completelyInsideObstacle: false,
      },
    ]
    this.finishedNodes = []
    this.nodeToOverlappingObstaclesMap = new Map()
    this.targets = this.srj.connections.flatMap((c) =>
      c.pointsToConnect.map((p) => ({
        ...p,
        connectionName: c.name,
        availableZ: p.layer === "top" ? [0] : [1],
      })),
    )
  }

  _nextNodeCounter = 0
  getNextNodeId(): string {
    return `cn${this._nextNodeCounter++}`
  }

  getCapacityFromDepth(depth: number): number {
    return (this.MAX_DEPTH - depth + 1) ** 2
  }

  getTargetIfNodeContainsTarget(node: CapacityMeshNode): Target | null {
    const overlappingObstacles = this.getOverlappingObstacles(node)
    for (const target of this.targets) {
      // if (target.layer !== node.layer) continue
      const targetObstacle = overlappingObstacles.find((o) =>
        isPointInRect(target, o),
      )

      if (targetObstacle) {
        if (doRectsOverlap(node, targetObstacle)) {
          return target
        }
      }

      if (
        target.x >= node.center.x - node.width / 2 &&
        target.x <= node.center.x + node.width / 2 &&
        target.y >= node.center.y - node.height / 2 &&
        target.y <= node.center.y + node.height / 2
      ) {
        return target
      }
    }
    return null
  }

  getOverlappingObstacles(node: CapacityMeshNode): Obstacle[] {
    const cachedObstacles = this.nodeToOverlappingObstaclesMap.get(
      node.capacityMeshNodeId,
    )
    if (cachedObstacles) {
      return cachedObstacles
    }
    const overlappingObstacles: Obstacle[] = []

    // Compute node bounds
    const nodeLeft = node.center.x - node.width / 2
    const nodeRight = node.center.x + node.width / 2
    const nodeTop = node.center.y - node.height / 2
    const nodeBottom = node.center.y + node.height / 2

    const obstacles = node._parent
      ? this.getOverlappingObstacles(node._parent)
      : this.srj.obstacles
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
        overlappingObstacles.push(obstacle)
      }
    }

    this.nodeToOverlappingObstaclesMap.set(
      node.capacityMeshNodeId,
      overlappingObstacles,
    )

    return overlappingObstacles
  }

  /**
   * Checks if the given mesh node overlaps with any obstacle.
   * We treat both obstacles and nodes as axis‐aligned rectangles.
   */
  doesNodeOverlapObstacle(node: CapacityMeshNode): boolean {
    const overlappingObstacles = this.getOverlappingObstacles(node)

    if (overlappingObstacles.length > 0) {
      return true
    }

    // Compute node bounds
    const nodeLeft = node.center.x - node.width / 2
    const nodeRight = node.center.x + node.width / 2
    const nodeTop = node.center.y - node.height / 2
    const nodeBottom = node.center.y + node.height / 2

    // If node is outside the bounds, we consider it to contain an obstacle
    if (
      nodeLeft < this.srj.bounds.minX ||
      nodeRight > this.srj.bounds.maxX ||
      nodeTop < this.srj.bounds.minY ||
      nodeBottom > this.srj.bounds.maxY
    ) {
      return true
    }
    return false
  }

  /**
   * Checks if the entire node is contained within any obstacle.
   */
  isNodeCompletelyInsideObstacle(node: CapacityMeshNode): boolean {
    const overlappingObstacles = this.getOverlappingObstacles(node)

    // Compute node bounds
    const nodeLeft = node.center.x - node.width / 2
    const nodeRight = node.center.x + node.width / 2
    const nodeTop = node.center.y - node.height / 2
    const nodeBottom = node.center.y + node.height / 2

    for (const obstacle of overlappingObstacles) {
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

    if (
      nodeRight < this.srj.bounds.minX ||
      nodeLeft > this.srj.bounds.maxX ||
      nodeBottom < this.srj.bounds.minY ||
      nodeTop > this.srj.bounds.maxY
    ) {
      return true
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
        availableZ: [0, 1],
        _depth: (parent._depth ?? 0) + 1,
        _parent: parent,
      }
      childNode._containsObstacle = this.doesNodeOverlapObstacle(childNode)

      const target = this.getTargetIfNodeContainsTarget(childNode)

      if (target) {
        childNode._targetConnectionName = target.connectionName
        childNode.availableZ = target.availableZ
        childNode._containsTarget = true
      }

      if (childNode._containsObstacle) {
        childNode._completelyInsideObstacle =
          this.isNodeCompletelyInsideObstacle(childNode)
      }
      if (childNode._completelyInsideObstacle && !childNode._containsTarget)
        continue
      childNodes.push(childNode)
    }

    return childNodes
  }

  shouldNodeBeSubdivided(node: CapacityMeshNode) {
    if (node._depth! >= this.MAX_DEPTH) return false
    if (node._containsTarget) return true
    if (node._containsObstacle && !node._completelyInsideObstacle) return true
    return false
  }

  _step() {
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
      } else if (!shouldBeSubdivided && newNode._containsTarget) {
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

    // Draw mesh nodes (both finished and unfinished)
    const allNodes = [...this.finishedNodes, ...this.unfinishedNodes]
    for (const node of allNodes) {
      graphics.rects!.push({
        center: node.center,
        width: Math.max(node.width - 2, node.width * 0.8),
        height: Math.max(node.height - 2, node.height * 0.8),
        fill: node._containsObstacle ? "rgba(255,0,0,0.1)" : "rgba(0,0,0,0.1)",
        label: `${node.capacityMeshNodeId}\navailableZ: ${node.availableZ.join(",")}`,
      })
    }

    // Draw connection points (each connection gets a unique color).
    this.srj.connections.forEach((connection, index) => {
      const color = COLORS[index % COLORS.length]
      for (const pt of connection.pointsToConnect) {
        graphics.points!.push({
          x: pt.x,
          y: pt.y,
          label: `conn-${index} (${pt.layer})`,
          color,
        })
      }
    })

    return graphics
  }
}
