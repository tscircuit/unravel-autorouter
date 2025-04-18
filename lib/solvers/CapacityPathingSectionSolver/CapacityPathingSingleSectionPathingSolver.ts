import {
  CapacityMeshEdge,
  CapacityMeshNode,
  CapacityMeshNodeId,
} from "lib/types"
import { BaseSolver } from "../BaseSolver"

export interface CapacityPathingSingleSectionPathingSolverParams {
  sectionNodes: CapacityMeshNode[]
  sectionEdges: CapacityMeshEdge[]
  sectionConnectionTerminals: Array<{
    connectionName: string
    startNodeId: CapacityMeshNodeId
    endNodeId: CapacityMeshNodeId
  }>
}

export class CapacityPathingSingleSectionPathingSolver extends BaseSolver {
  sectionNodes: CapacityMeshNode[]
  sectionEdges: CapacityMeshEdge[]
  sectionConnectionTerminals: Array<{
    connectionName: string
    startNodeId: CapacityMeshNodeId
    endNodeId: CapacityMeshNodeId
  }>

  constructor(params: CapacityPathingSingleSectionPathingSolverParams) {
    super()

    this.sectionNodes = params.sectionNodes
    this.sectionEdges = params.sectionEdges
    this.sectionConnectionTerminals = params.sectionConnectionTerminals
  }

  _step() {
    // TODO
  }

  visualize() {
    // TODO
  }
}
