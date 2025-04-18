import { GraphicsObject } from "graphics-debug"
import {
  CapacityMeshEdge,
  CapacityMeshNode,
  CapacityMeshNodeId,
} from "lib/types"
import { BaseSolver } from "../BaseSolver"
import { visualizeSection } from "./visualizeSection"

export interface CapacityPathingSingleSectionPathingSolverParams {
  sectionNodes: CapacityMeshNode[]
  sectionEdges: CapacityMeshEdge[]
  sectionConnectionTerminals: Array<{
    // Corrected this part
    connectionName: string
    startNodeId: CapacityMeshNodeId
    endNodeId: CapacityMeshNodeId
  }>
  colorMap?: Record<string, string> // Make colorMap optional in params
}

export class CapacityPathingSingleSectionPathingSolver extends BaseSolver {
  sectionNodes: CapacityMeshNode[]
  sectionEdges: CapacityMeshEdge[]
  sectionConnectionTerminals: Array<{
    connectionName: string
    startNodeId: CapacityMeshNodeId
    endNodeId: CapacityMeshNodeId
  }>
  nodeMap: Map<CapacityMeshNodeId, CapacityMeshNode>
  colorMap: Record<string, string> // Added colorMap

  constructor(params: CapacityPathingSingleSectionPathingSolverParams) {
    super()

    this.sectionNodes = params.sectionNodes // Assign sectionNodes first
    this.sectionEdges = params.sectionEdges
    this.sectionConnectionTerminals = params.sectionConnectionTerminals
    this.nodeMap = new Map(
      this.sectionNodes.map((n) => [n.capacityMeshNodeId, n]), // Now it's safe to use sectionNodes
    )
    this.colorMap = params.colorMap ?? {} // Initialize colorMap
  }

  _step() {
    // TODO: Implement pathing logic within the section
    this.solved = true // Placeholder
  }

  visualize(): GraphicsObject {
    // Use the shared visualization function
    return visualizeSection({
      sectionNodes: this.sectionNodes,
      sectionEdges: this.sectionEdges, // Assuming these are already filtered
      sectionConnectionTerminals: this.sectionConnectionTerminals,
      nodeMap: this.nodeMap,
      colorMap: this.colorMap,
      centerNodeId: null, // No specific center node in this context
      title: `Section Pathing Solver (${this.sectionNodes.length} nodes)`,
    })
  }
}
