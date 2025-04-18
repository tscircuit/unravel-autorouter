import {
  CapacityMeshNode,
  CapacityMeshEdge,
  CapacityMeshNodeId,
} from "lib/types"
import { ConnectionPathWithNodes } from "../CapacityPathingSolver/CapacityPathingSolver"
import { GraphicsObject } from "graphics-debug"
import { BaseSolver } from "../BaseSolver"

export interface CapacityPathingSingleSectionSolverInput {
  centerNodeId: CapacityMeshNodeId
  connectionsWithNodes: Array<ConnectionPathWithNodes>
  nodes: CapacityMeshNode[]
  edges: CapacityMeshEdge[]
  expansionDegrees?: number
}

export class CapacityPathingSingleSectionSolver extends BaseSolver {
  centerNodeId: CapacityMeshNodeId
  connectionsWithNodes: Array<ConnectionPathWithNodes>
  nodes: CapacityMeshNode[]
  edges: CapacityMeshEdge[]
  expansionDegrees: number

  constructor(params: CapacityPathingSingleSectionSolverInput) {
    super()

    this.centerNodeId = params.centerNodeId
    this.connectionsWithNodes = params.connectionsWithNodes
    this.nodes = params.nodes
    this.edges = params.edges
    this.expansionDegrees = params.expansionDegrees ?? 1
  }

  _step() {}

  getConstructorParams() {
    return [
      {
        centerNodeId: this.centerNodeId,
        connectionsWithNodes: this.connectionsWithNodes,
        nodes: this.nodes,
        edges: this.edges,
        expansionDegrees: this.expansionDegrees,
      },
    ] as const
  }

  visualize(): GraphicsObject {
    // simple viz: highlight the center node
    const graphics: GraphicsObject = {
      points: [],
      lines: [],
      rects: [],
      circles: [],
    }

    const centerNode = this.nodes.find(
      (n) => n.capacityMeshNodeId === this.centerNodeId,
    )
    if (centerNode) {
      graphics.rects!.push({
        center: centerNode.center,
        width: centerNode.width,
        height: centerNode.height,
        fill: "rgba(0,255,0,0.1)",
        stroke: "green",
        label: `center: ${centerNode.capacityMeshNodeId}`,
      })
    }
    return graphics
  }
}
