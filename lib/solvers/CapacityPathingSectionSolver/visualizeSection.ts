import { GraphicsObject } from "graphics-debug"
import {
  CapacityMeshEdge,
  CapacityMeshNode,
  CapacityMeshNodeId,
} from "lib/types"
import { createRectFromCapacityNode } from "lib/utils/createRectFromCapacityNode"
import { getLinesBetweenNodes } from "lib/utils/getLinesBetweenNodes"

interface VisualizeSectionParams {
  sectionNodes: CapacityMeshNode[]
  sectionEdges: CapacityMeshEdge[] // Edges *only* within the section
  sectionConnectionTerminals: Array<{
    connectionName: string
    startNodeId: CapacityMeshNodeId
    endNodeId: CapacityMeshNodeId
  }>
  nodeMap: Map<CapacityMeshNodeId, CapacityMeshNode> // Map for all relevant nodes (section + potentially neighbors if needed for edges)
  colorMap: Record<string, string>
  centerNodeId?: CapacityMeshNodeId | null // Optional: for highlighting the center
  title: string // Custom title for the visualization
}

export function visualizeSection({
  sectionNodes,
  sectionEdges,
  sectionConnectionTerminals,
  nodeMap,
  colorMap,
  centerNodeId,
  title,
}: VisualizeSectionParams): GraphicsObject {
  const graphics: GraphicsObject = {
    points: [],
    lines: [],
    rects: [],
    circles: [],
    title: title,
  }

  const sectionNodeIds = new Set(
    sectionNodes.map((n) => n.capacityMeshNodeId),
  )

  // Highlight all nodes in the section
  for (const node of sectionNodes) {
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

    // Override for center node if provided
    if (centerNodeId && node.capacityMeshNodeId === centerNodeId) {
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
  for (const edge of sectionEdges) {
    const [nodeIdA, nodeIdB] = edge.nodeIds
    // Both nodes must be in the provided nodeMap to draw the edge
    const nodeA = nodeMap.get(nodeIdA)
    const nodeB = nodeMap.get(nodeIdB)
    if (nodeA && nodeB) {
      const { lineStart, lineEnd } = getLinesBetweenNodes(nodeA, nodeB)
      graphics.lines!.push({
        points: [lineStart, lineEnd],
        strokeColor: "rgba(0, 0, 0, 0.3)", // Light gray for intra-section edges
      })
    }
  }

  // Highlight connection terminals within the section
  sectionConnectionTerminals.forEach((terminal, index) => {
    const startNode = nodeMap.get(terminal.startNodeId)
    const endNode = nodeMap.get(terminal.endNodeId)
    const connectionColor = colorMap[terminal.connectionName] ?? "black" // Default to black if not found

    // Ensure terminals are actually within the visualized section nodes
    const isStartInSection = startNode && sectionNodeIds.has(startNode.capacityMeshNodeId)
    const isEndInSection = endNode && sectionNodeIds.has(endNode.capacityMeshNodeId)


    const offsetMultiplier = (index + index / 50) % 5 // Simple offset logic
    let startOffsetX = 0
    let startOffsetY = 0
    let endOffsetX = 0
    let endOffsetY = 0

    if (isStartInSection && startNode) {
      const baseOffset = 0.02 * Math.min(startNode.width, startNode.height)
      startOffsetX = baseOffset * offsetMultiplier
      startOffsetY = baseOffset * offsetMultiplier
      graphics.points!.push({
        x: startNode.center.x + startOffsetX,
        y: startNode.center.y + startOffsetY,
        color: connectionColor,
        label: `Start: ${terminal.connectionName}\n(${terminal.startNodeId})`,
      })
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

    if (isEndInSection && endNode) {
      const baseOffset = 0.02 * Math.min(endNode.width, endNode.height)
      endOffsetX = baseOffset * offsetMultiplier
      endOffsetY = baseOffset * offsetMultiplier
      graphics.points!.push({
        x: endNode.center.x + endOffsetX,
        y: endNode.center.y + endOffsetY,
        color: connectionColor,
        label: `End: ${terminal.connectionName}\n(${terminal.endNodeId})`,
      })
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

    // Draw a line between terminals only if both are within the section
    if (isStartInSection && isEndInSection && startNode && endNode) {
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
        strokeColor: connectionColor,
        strokeDash: "5 5",
      })
    }
  })

  return graphics
}
