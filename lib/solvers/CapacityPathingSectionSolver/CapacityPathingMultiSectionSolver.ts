import {
  CapacityMeshEdge,
  CapacityMeshNode,
  CapacityMeshNodeId,
  CapacityPath,
  SimpleRouteJson,
} from "lib/types"
import { BaseSolver } from "../BaseSolver"
import { CapacityPathingSolver } from "../CapacityPathingSolver/CapacityPathingSolver"
import { CapacityPathingGreedySolver } from "./CapacityPathingGreedySolver"
import { HyperCapacityPathingSingleSectionSolver } from "./HyperCapacityPathingSingleSectionSolver"

/**
 * This solver solves for capacity paths by first solving with negative
 * capacities allowed, then re-solving problematic sections with a section
 * solver.
 */
export class CapacityPathingMultiSectionSolver extends BaseSolver {
  simpleRouteJson: SimpleRouteJson
  nodes: CapacityMeshNode[]
  edges: CapacityMeshEdge[]
  colorMap: Record<string, string>

  initialSolver: CapacityPathingGreedySolver
  sectionSolver?: HyperCapacityPathingSingleSectionSolver

  stage: "initialization" | "section-optimization" = "initialization"

  nodeMap: Map<CapacityMeshNodeId, CapacityMeshNode> = new Map()

  constructor(params: ConstructorParameters<typeof CapacityPathingSolver>[0]) {
    super()
    this.simpleRouteJson = params.simpleRouteJson
    this.nodes = params.nodes
    this.edges = params.edges
    this.colorMap = params.colorMap ?? {}
    this.nodeMap = new Map(
      this.nodes.map((node) => [node.capacityMeshNodeId, node]),
    )
    this.initialSolver = new CapacityPathingGreedySolver({
      simpleRouteJson: this.simpleRouteJson,
      nodes: this.nodes,
      edges: this.edges,
      colorMap: this.colorMap,
    })
  }

  _stepInitialization() {
    this.initialSolver?.solve()
    if (this.initialSolver?.failed) {
      this.failed = true
      return
    }
    if (this.initialSolver?.solved) {
      this.stage = "section-optimization"
    }
  }

  _stepSectionOptimization() {}

  _step() {
    if (this.stage === "initialization") {
      this._stepInitialization()
    } else if (this.stage === "section-optimization") {
      this._stepSectionOptimization()
    }
  }

  visualize() {
    return this.initialSolver.visualize()
  }
}
