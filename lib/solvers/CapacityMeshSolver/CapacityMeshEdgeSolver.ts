import type { GraphicsObject } from "graphics-debug"
import type {
  CapacityMeshEdge,
  CapacityMeshNode,
} from "../../types/capacity-mesh-types"
import { BaseSolver } from "../BaseSolver"

export class CapacityMeshEdgeSolver extends BaseSolver {
  public edges: Array<CapacityMeshEdge>

  constructor(public nodes: CapacityMeshNode[]) {
    super()
    this.edges = []
  }

  getNextCapacityMeshEdgeId() {
    return `ce${this.edges.length}`
  }

  step() {
    this.edges = []
    for (let i = 0; i < this.nodes.length; i++) {
      for (let j = i + 1; j < this.nodes.length; j++) {
        if (this.areNodesBordering(this.nodes[i], this.nodes[j])) {
          this.edges.push({
            capacityMeshEdgeId: this.getNextCapacityMeshEdgeId(),
            nodeIds: [
              this.nodes[i].capacityMeshNodeId,
              this.nodes[j].capacityMeshNodeId,
            ],
          })
        }
      }
    }
    this.solved = true
  }

  private areNodesBordering(
    node1: CapacityMeshNode,
    node2: CapacityMeshNode,
  ): boolean {
    const n1Left = node1.center.x - node1.width / 2
    const n1Right = node1.center.x + node1.width / 2
    const n1Top = node1.center.y - node1.height / 2
    const n1Bottom = node1.center.y + node1.height / 2

    const n2Left = node2.center.x - node2.width / 2
    const n2Right = node2.center.x + node2.width / 2
    const n2Top = node2.center.y - node2.height / 2
    const n2Bottom = node2.center.y + node2.height / 2

    const minOverlap = 1

    const shareVerticalBorder =
      (Math.abs(n1Right - n2Left) < 1 || Math.abs(n1Left - n2Right) < 1) &&
      Math.min(n1Bottom, n2Bottom) - Math.max(n1Top, n2Top) >= minOverlap

    const shareHorizontalBorder =
      (Math.abs(n1Bottom - n2Top) < 1 || Math.abs(n1Top - n2Bottom) < 1) &&
      Math.min(n1Right, n2Right) - Math.max(n1Left, n2Left) >= minOverlap

    return shareVerticalBorder || shareHorizontalBorder
  }

  visualize(): GraphicsObject {
    const graphics: GraphicsObject = {
      lines: [],
      points: [],
      rects: this.nodes.map((node) => ({
        width: node.width - 2,
        height: node.height - 2,
        center: node.center,
        fill: node._containsObstacle
          ? "rgba(255,0,0,0.1)"
          : node._containsTarget
            ? "rgba(0,255,0,0.2)"
            : "rgba(0,0,0,0.1)",
      })),
      circles: [],
    }
    for (const edge of this.edges) {
      const node1 = this.nodes.find(
        (node) => node.capacityMeshNodeId === edge.nodeIds[0],
      )
      const node2 = this.nodes.find(
        (node) => node.capacityMeshNodeId === edge.nodeIds[1],
      )
      if (node1?.center && node2?.center) {
        graphics.lines!.push({
          points: [node1.center, node2.center],
        })
      }
    }
    return graphics
  }
}
