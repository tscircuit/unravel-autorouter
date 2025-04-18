import {
  CapacityMeshEdge,
  CapacityMeshNode,
  CapacityMeshNodeId,
  CapacityPath,
  SimpleRouteJson,
} from "lib/types"
import { BaseSolver } from "../BaseSolver"
import {
  CapacityPathingSolver,
  ConnectionPathWithNodes,
} from "../CapacityPathingSolver/CapacityPathingSolver"
import { CapacityPathingGreedySolver } from "./CapacityPathingGreedySolver"
import { HyperCapacityPathingSingleSectionSolver } from "./HyperCapacityPathingSingleSectionSolver"
import { CapacityPathingSingleSectionSolver } from "./CapacityPathingSingleSectionSolver"

/**
 * This solver solves for capacity paths by first solving with negative
 * capacities allowed, then re-solving problematic sections with a section
 * solver.
 */
export class CapacityPathingMultiSectionSolver extends BaseSolver {
  simpleRouteJson: SimpleRouteJson
  nodes: CapacityMeshNode[]
  edges: CapacityMeshEdge[]
  connectionsWithNodes: Array<ConnectionPathWithNodes> = [] // Initialize here
  colorMap: Record<string, string>

  initialSolver: CapacityPathingGreedySolver

  stage: "initialization" | "section-optimization" = "initialization"

  nodeMap: Map<CapacityMeshNodeId, CapacityMeshNode> = new Map()

  nodeCapacityPercentMap: Map<CapacityMeshNodeId, number> = new Map()
  nodeOptimizationAttemptCountMap: Map<CapacityMeshNodeId, number> = new Map()

  activeSubSolver?: CapacityPathingSingleSectionSolver | null = null

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
    if (!this.initialSolver?.solved) {
      this.failed = true
      this.error = this.initialSolver.error
      return
    }
    const { usedNodeCapacityMap } = this.initialSolver

    for (const node of this.nodes) {
      this.nodeCapacityPercentMap.set(
        node.capacityMeshNodeId,
        (usedNodeCapacityMap.get(node.capacityMeshNodeId) ?? 0) /
          this.initialSolver.getTotalCapacity(node),
      )
      this.nodeOptimizationAttemptCountMap.set(node.capacityMeshNodeId, 0)
    }

    this.connectionsWithNodes = this.initialSolver.connectionsWithNodes

    this.stage = "section-optimization"
  }

  _getNextNodeToOptimize(): CapacityMeshNodeId | null {
    // Get the node with the highest % capacity used with no attempts
    let highestPercentCapacityUsed = 0
    let nodeWithHighestPercentCapacityUsed: CapacityMeshNodeId | null = null
    for (const node of this.nodes) {
      if (node._containsTarget) continue
      const attemptCount = this.nodeOptimizationAttemptCountMap.get(
        node.capacityMeshNodeId,
      )!
      const percentCapacityUsed = this.nodeCapacityPercentMap.get(
        node.capacityMeshNodeId,
      )!
      if (
        attemptCount === 0 &&
        percentCapacityUsed > highestPercentCapacityUsed &&
        percentCapacityUsed > 1
      ) {
        highestPercentCapacityUsed = percentCapacityUsed
        nodeWithHighestPercentCapacityUsed = node.capacityMeshNodeId
      }
    }
    return nodeWithHighestPercentCapacityUsed
  }

  _stepSectionOptimization() {
    if (!this.activeSubSolver) {
      const centerNodeId = this._getNextNodeToOptimize()
      if (!centerNodeId) {
        // No more nodes to optimize
        this.solved = true
        return
      }
      this.activeSubSolver = new CapacityPathingSingleSectionSolver({
        centerNodeId,
        connectionsWithNodes: this.connectionsWithNodes,
        nodes: this.nodes,
        edges: this.edges,
        colorMap: this.colorMap,
        expansionDegrees: 3,
      })
    }

    this.activeSubSolver!.step()
    if (this.activeSubSolver!.solved) {
      // Apply results to edges
      // TODO: Update node capacity percent map
      this.activeSubSolver = null
    }
  }

  _step() {
    if (this.stage === "initialization") {
      this._stepInitialization()
    } else if (this.stage === "section-optimization") {
      this._stepSectionOptimization()
    }
  }

  visualize() {
    return (
      this.activeSubSolver?.activeSubSolver?.visualize() ??
      this.activeSubSolver?.visualize() ??
      this.initialSolver.visualize()
    )
  }
}
