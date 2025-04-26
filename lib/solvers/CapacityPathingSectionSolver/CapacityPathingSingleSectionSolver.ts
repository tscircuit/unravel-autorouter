import {
  CapacityMeshNode,
  CapacityMeshEdge,
  CapacityMeshNodeId,
} from "lib/types"
import { ConnectionPathWithNodes } from "../CapacityPathingSolver/CapacityPathingSolver"
import { GraphicsObject } from "graphics-debug"
import { getNodeEdgeMap } from "../CapacityMeshSolver/getNodeEdgeMap"
import { BaseSolver } from "../BaseSolver"
import { visualizeSection } from "./visualizeSection"
import {
  CapacityPathingSingleSectionPathingSolver,
  CpssPathingSolverHyperParameters,
} from "./CapacityPathingSingleSectionPathingSolver"
import {
  computeSectionNodesTerminalsAndEdges,
  SectionConnectionTerminal,
} from "./computeSectionNodesTerminalsAndEdges"

export interface CapacityPathingSingleSectionSolverInput {
  centerNodeId: CapacityMeshNodeId
  connectionsWithNodes: Array<ConnectionPathWithNodes>
  nodes: CapacityMeshNode[]
  edges: CapacityMeshEdge[]
  colorMap: Record<string, string>
  hyperParameters?: CpssPathingSolverHyperParameters
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
  sectionEdges: CapacityMeshEdge[] // Added sectionEdges property
  sectionConnectionTerminals: Array<SectionConnectionTerminal>
  activeSubSolver?:
    | CapacityPathingSingleSectionPathingSolver
    | null
    | undefined = null

  constructor(params: CapacityPathingSingleSectionSolverInput) {
    super()

    this.MAX_ITERATIONS = 100_000
    this.colorMap = params.colorMap
    this.centerNodeId = params.centerNodeId
    this.connectionsWithNodes = params.connectionsWithNodes
    this.nodes = params.nodes
    this.nodeMap = new Map(this.nodes.map((n) => [n.capacityMeshNodeId, n]))
    this.edges = params.edges
    this.nodeEdgeMap = getNodeEdgeMap(this.edges)
    this.expansionDegrees = params.hyperParameters?.EXPANSION_DEGREES ?? 3

    this.sectionNodes = []
    this.sectionEdges = [] // Initialize sectionEdges
    this.sectionConnectionTerminals = []

    this.computeSectionNodesTerminalsAndEdges()

    this.activeSubSolver = new CapacityPathingSingleSectionPathingSolver({
      sectionConnectionTerminals: this.sectionConnectionTerminals,
      sectionNodes: this.sectionNodes,
      sectionEdges: this.sectionEdges,
      colorMap: this.colorMap,
      hyperParameters: params.hyperParameters,
    })
  }

  private computeSectionNodesTerminalsAndEdges() {
    const { sectionNodes, sectionEdges, sectionConnectionTerminals } =
      computeSectionNodesTerminalsAndEdges({
        centerNodeId: this.centerNodeId,
        nodeMap: this.nodeMap,
        edges: this.edges,
        connectionsWithNodes: this.connectionsWithNodes,
        nodeEdgeMap: this.nodeEdgeMap,
        expansionDegrees: this.expansionDegrees,
      })
  }

  _step() {
    this.activeSubSolver?.step()
    if (this.activeSubSolver?.solved) {
      this.solved = true
      return
    }
    if (this.activeSubSolver?.failed) {
      this.failed = true
      this.error = this.activeSubSolver.error
      return
    }
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
    return visualizeSection({
      sectionNodes: this.sectionNodes,
      sectionEdges: this.sectionEdges, // Use the computed class property
      sectionConnectionTerminals: this.sectionConnectionTerminals,
      nodeMap: this.nodeMap,
      colorMap: this.colorMap,
      centerNodeId: this.centerNodeId,
      nodeOpacity: 0.001,
      title: `Section Solver (Center: ${this.centerNodeId}, Hops: ${this.expansionDegrees})`,
    })
  }
}
