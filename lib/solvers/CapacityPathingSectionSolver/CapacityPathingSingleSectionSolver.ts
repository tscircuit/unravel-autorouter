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
import { getLinesBetweenNodes } from "lib/utils/getLinesBetweenNodes"

export interface CapacityPathingSingleSectionSolverInput {
  centerNodeId: CapacityMeshNodeId
  connectionsWithNodes: Array<ConnectionPathWithNodes>
  nodes: CapacityMeshNode[]
  edges: CapacityMeshEdge[]
  expansionDegrees: number
  colorMap: Record<string, string>
}

export class CapacityPathingSingleSectionSolver extends BaseSolver {
  centerNodeId: CapacityMeshNodeId
  connectionsWithNodes: Array<ConnectionPathWithNodes>
  nodes: CapacityMeshNode[]
  nodeMap: Map<CapacityMeshNodeId, CapacityMeshNode>
  edges: CapacityMeshEdge[]
  nodeEdgeMap: Map<CapacityMeshNodeId, CapacityMeshEdge[]>
  expansionDegrees: number
  colorMap: Record<string, string>
  sectionNodes: CapacityMeshNode[]
  sectionConnectionTerminals: Array<{
    connectionName: string
    startNodeId: CapacityMeshNodeId
    endNodeId: CapacityMeshNodeId
  }>

  constructor(params: CapacityPathingSingleSectionSolverInput) {
    super()

    this.colorMap = params.colorMap
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
      let nodeFill = "rgba(128, 128, 128, 0.2)" // Default gray
      let nodeStroke = "gray"

      const availableZ = node.availableZ ?? []
      const hasZ0 = availableZ.includes(0)
      const hasZ1 = availableZ.includes(1)

      if (hasZ0 && hasZ1) {
        nodeFill = "rgba(128, 0, 128, 0.2)" // Purple
        nodeStroke = "purple"
      } else if (hasZ0) {
        nodeFill = "rgba(0, 0, 255, 0.2)" // Blue
        nodeStroke = "blue"
      } else if (hasZ1) {
        nodeFill = "rgba(255, 0, 0, 0.2)" // Red
        nodeStroke = "red"
      }

      // Override for center node
      if (node.capacityMeshNodeId === this.centerNodeId) {
        nodeFill = "rgba(0, 255, 0, 0.3)" // Center node green
        nodeStroke = "green"
      }

      graphics.rects!.push({
        ...createRectFromCapacityNode(node),
        fill: nodeFill,
        stroke: nodeStroke,
        label: `${node.capacityMeshNodeId}\n(Section Node)\nZ: ${availableZ.join(
          ",",
        )}`,
      })
    }

    // Draw edges within the section
    const sectionNodeIds = new Set(
      this.sectionNodes.map((n) => n.capacityMeshNodeId),
    )
    for (const edge of this.edges) {
      const [nodeIdA, nodeIdB] = edge.nodeIds
      if (sectionNodeIds.has(nodeIdA) && sectionNodeIds.has(nodeIdB)) {
        const nodeA = this.nodeMap.get(nodeIdA)
        const nodeB = this.nodeMap.get(nodeIdB)
        if (nodeA && nodeB) {
          const { lineStart, lineEnd } = getLinesBetweenNodes(nodeA, nodeB)
          graphics.lines!.push({
            points: [lineStart, lineEnd],
            strokeColor: "rgba(0, 0, 0, 0.3)", // Light gray for intra-section edges
          })
        }
      }
    }

    // Highlight connection terminals within the section
    this.sectionConnectionTerminals.forEach((terminal, index) => {
      const startNode = this.nodeMap.get(terminal.startNodeId)
      const endNode = this.nodeMap.get(terminal.endNodeId)
      const connectionColor = this.colorMap[terminal.connectionName] ?? "black" // Default to black if not found

      const offsetMultiplier = (index + index / 50) % 5
      let startOffsetX = 0
      let startOffsetY = 0
      let endOffsetX = 0
      let endOffsetY = 0

      if (startNode) {
        const baseOffset = 0.02 * Math.min(startNode.width, startNode.height)
        startOffsetX = baseOffset * offsetMultiplier
        startOffsetY = baseOffset * offsetMultiplier // Apply same offset for simplicity, could vary
        graphics.points!.push({
          x: startNode.center.x + startOffsetX,
          y: startNode.center.y + startOffsetY,
          color: connectionColor, // Use connection color
          label: `Start: ${terminal.connectionName}\n(${terminal.startNodeId})`,
        })
        // Add line from original center to offset point
        graphics.lines!.push({
          points: [
            { x: startNode.center.x, y: startNode.center.y },
            {
              x: startNode.center.x + startOffsetX,
              y: startNode.center.y + startOffsetY,
            },
          ],
          strokeColor: "gray",
          strokeDash: "2 2",
        })
      }
      if (endNode) {
        const baseOffset = 0.02 * Math.min(endNode.width, endNode.height)
        endOffsetX = baseOffset * offsetMultiplier
        endOffsetY = baseOffset * offsetMultiplier // Apply same offset for simplicity
        graphics.points!.push({
          x: endNode.center.x + endOffsetX,
          y: endNode.center.y + endOffsetY,
          color: connectionColor, // Use connection color
          label: `End: ${terminal.connectionName}\n(${terminal.endNodeId})`,
        })
        // Add line from original center to offset point
        graphics.lines!.push({
          points: [
            { x: endNode.center.x, y: endNode.center.y },
            {
              x: endNode.center.x + endOffsetX,
              y: endNode.center.y + endOffsetY,
            },
          ],
          strokeColor: "gray",
          strokeDash: "2 2",
        })
      }
      // Optionally draw a line between terminals within the section
      if (startNode && endNode) {
        graphics.lines!.push({
          points: [
            {
              x: startNode.center.x + startOffsetX,
              y: startNode.center.y + startOffsetY,
            },
            {
              x: endNode.center.x + endOffsetX,
              y: endNode.center.y + endOffsetY,
            },
          ],
          strokeColor: connectionColor, // Use connection color
          strokeDash: "5 5",
        })
      }
    })

    return graphics
  }
}
