import type { GraphicsObject } from "graphics-debug"
import { BaseSolver } from "./BaseSolver"
import type {
  CapacityMeshEdge,
  CapacityMeshNode,
  SimpleRouteJson,
} from "../types"

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

  doesNodeContainObstacle(node: CapacityMeshNode): boolean {
    const obstacles = this.srj.obstacles
    for (const obstacle of obstacles) {
      const { center, width, height } = obstacle
      // TODO
    }
    return false
  }

  isNodeCompletelyInsideObstacle(node: CapacityMeshNode): boolean {
    const obstacles = this.srj.obstacles
    for (const obstacle of obstacles) {
      const { center, width, height } = obstacle
      // TODO
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
    return node._depth !== this.MAX_DEPTH
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
      if (this.shouldNodeBeSubdivided(newNode)) {
        unfinishedNewNodes.push(newNode)
      } else {
        finishedNewNodes.push(newNode)
      }
    }

    this.unfinishedNodes.push(...unfinishedNewNodes)
    this.finishedNodes.push(...finishedNewNodes)
  }

  visualize(): GraphicsObject {
    // TODO
    return {
      lines: [],
      points: [],
      rects: [],
      circles: [],
    }
  }
}
