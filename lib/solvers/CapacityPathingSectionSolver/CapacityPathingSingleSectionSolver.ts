import {
  CapacityMeshNode,
  CapacityMeshEdge,
  CapacityMeshNodeId,
} from "lib/types"
import { ConnectionPathWithNodes } from "../CapacityPathingSolver/CapacityPathingSolver"
import { GraphicsObject } from "graphics-debug"
import { getNodeEdgeMap } from "../CapacityMeshSolver/getNodeEdgeMap"
import { BaseSolver } from "../BaseSolver"
import { createRectFromCapacityNode } from "lib/utils/createRectFromCapacityNode"

export interface CapacityPathingSingleSectionSolverInput {
  centerNodeId: CapacityMeshNodeId
  connectionsWithNodes: Array<ConnectionPathWithNodes>
  nodes: CapacityMeshNode[]
  edges: CapacityMeshEdge[]
  expansionDegrees: number
}

export class CapacityPathingSingleSectionSolver extends BaseSolver {
  centerNodeId: CapacityMeshNodeId
  connectionsWithNodes: Array<ConnectionPathWithNodes>
  nodes: CapacityMeshNode[]
  nodeMap: Map<CapacityMeshNodeId, CapacityMeshNode>
  edges: CapacityMeshEdge[]
  nodeEdgeMap: Map<CapacityMeshNodeId, CapacityMeshEdge[]>
  expansionDegrees: number

  sectionNodes: CapacityMeshNode[]
  sectionConnectionTerminals: Array<{
    connectionName: string
    startNodeId: CapacityMeshNodeId
    endNodeId: CapacityMeshNodeId
  }>

  constructor(params: CapacityPathingSingleSectionSolverInput) {
    super()

    this.centerNodeId = params.centerNodeId
    this.connectionsWithNodes = params.connectionsWithNodes
    this.nodes = params.nodes
    this.nodeMap = new Map(this.nodes.map((n) => [n.capacityMeshNodeId, n]))
    this.edges = params.edges
    this.nodeEdgeMap = getNodeEdgeMap(this.edges)
    this.expansionDegrees = params.expansionDegrees ?? 1
    this.sectionNodes = []
    this.sectionConnectionTerminals = []

    this.computeSectionNodesAndTerminals()
  }

  private computeSectionNodesAndTerminals() {
    const sectionNodeIds = new Set<CapacityMeshNodeId>()
    const queue: Array<{ nodeId: CapacityMeshNodeId; depth: number }> = [
      { nodeId: this.centerNodeId, depth: 0 },
    ]
    sectionNodeIds.add(this.centerNodeId)

    let head = 0
    while (head < queue.length) {
      const { nodeId, depth } = queue[head++]

      if (depth >= this.expansionDegrees) continue

      const neighbors =
        this.nodeEdgeMap
          .get(nodeId)
          ?.flatMap((edge) => edge.nodeIds.filter((id) => id !== nodeId)) ?? []

      for (const neighborId of neighbors) {
        if (!sectionNodeIds.has(neighborId)) {
          sectionNodeIds.add(neighborId)
          queue.push({ nodeId: neighborId, depth: depth + 1 })
        }
      }
    }

    this.sectionNodes = Array.from(sectionNodeIds).map(
      (id) => this.nodeMap.get(id)!,
    )

    // Compute terminals
    this.sectionConnectionTerminals = []
    for (const conn of this.connectionsWithNodes) {
      if (!conn.path) continue

      let startNodeId: CapacityMeshNodeId | null = null
      let endNodeId: CapacityMeshNodeId | null = null

      // Find the first node in the path that is within the section
      for (const node of conn.path) {
        if (sectionNodeIds.has(node.capacityMeshNodeId)) {
          startNodeId = node.capacityMeshNodeId
          break
        }
      }

      // Find the last node in the path that is within the section
      for (let i = conn.path.length - 1; i >= 0; i--) {
        const node = conn.path[i]
        if (sectionNodeIds.has(node.capacityMeshNodeId)) {
          endNodeId = node.capacityMeshNodeId
          break
        }
      }

      if (startNodeId && endNodeId) {
        this.sectionConnectionTerminals.push({
          connectionName: conn.connection.name,
          startNodeId,
          endNodeId,
        })
      }
    }
  }

  _step() {
    // TODO: Implement the actual optimization logic for the section
  }

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
      title: `Section Solver (Center: ${this.centerNodeId}, Hops: ${this.expansionDegrees})`,
    }

    // Highlight all nodes in the section
    for (const node of this.sectionNodes) {
      graphics.rects!.push({
        ...createRectFromCapacityNode(node),
        fill:
          node.capacityMeshNodeId === this.centerNodeId
            ? "rgba(0, 255, 0, 0.3)" // Center node green
            : "rgba(255, 165, 0, 0.2)", // Other section nodes orange
        stroke:
          node.capacityMeshNodeId === this.centerNodeId ? "green" : "orange",
        label: `${node.capacityMeshNodeId}\n(Section Node)`,
      })
    }

    // Highlight connection terminals within the section
    for (const terminal of this.sectionConnectionTerminals) {
      const startNode = this.nodeMap.get(terminal.startNodeId)
      const endNode = this.nodeMap.get(terminal.endNodeId)

      if (startNode) {
        graphics.points!.push({
          x: startNode.center.x,
          y: startNode.center.y,
          color: "purple",
          label: `Start: ${terminal.connectionName}\n(${terminal.startNodeId})`,
        })
      }
      if (endNode) {
        graphics.points!.push({
          x: endNode.center.x,
          y: endNode.center.y,
          color: "magenta",
          label: `End: ${terminal.connectionName}\n(${terminal.endNodeId})`,
        })
      }
      // Optionally draw a line between terminals within the section
      if (startNode && endNode) {
        graphics.lines!.push({
          points: [startNode.center, endNode.center],
          strokeColor: "rgba(128, 0, 128, 0.5)", // Purple dashed line
          strokeDash: "5 5",
        })
      }
    }

    return graphics
  }
}
