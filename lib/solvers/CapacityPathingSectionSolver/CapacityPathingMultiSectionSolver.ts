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
import { getTunedTotalCapacity1 } from "lib/utils/getTunedTotalCapacity1"
import { visualizeSection } from "./visualizeSection"
import {
  calculateNodeProbabilityOfFailure,
  computeSectionScore,
} from "./computeSectionScore" // Added import

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
  usedNodeCapacityMap: Map<CapacityMeshNodeId, number> = new Map()
  totalNodeCapacityMap: Map<CapacityMeshNodeId, number> = new Map() // Added

  nodeCapacityPercentMap: Map<CapacityMeshNodeId, number> = new Map()
  nodeOptimizationAttemptCountMap: Map<CapacityMeshNodeId, number> = new Map()

  sectionSolver?: CapacityPathingSingleSectionSolver | null = null

  MAX_ATTEMPTS_PER_NODE = 2

  constructor(params: ConstructorParameters<typeof CapacityPathingSolver>[0]) {
    super()
    this.MAX_ITERATIONS = 1e6
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
    this.activeSubSolver = this.initialSolver

    // Calculate and store total capacity for each node (only needs to be done once)
    for (const node of this.nodes) {
      const totalCapacity = this.initialSolver.getTotalCapacity(node)
      this.totalNodeCapacityMap.set(node.capacityMeshNodeId, totalCapacity)
    }
  }

  _stepInitialization() {
    this.initialSolver?.solve()
    if (this.initialSolver?.failed) {
      this.failed = true
      this.error = this.initialSolver.error
      return
    }
    if (this.initialSolver?.solved) {
      // Initialize the class's usedNodeCapacityMap from the initial solver
      this.usedNodeCapacityMap = new Map(this.initialSolver.usedNodeCapacityMap)

      // Calculate initial capacity percentages and reset attempt counts
      for (const node of this.nodes) {
        const totalCapacity =
          this.totalNodeCapacityMap.get(node.capacityMeshNodeId) ?? 0 // Use pre-calculated total capacity
        const usedCapacity =
          this.usedNodeCapacityMap.get(node.capacityMeshNodeId) ?? 0
        const percentUsed = totalCapacity > 0 ? usedCapacity / totalCapacity : 0

        this.nodeCapacityPercentMap.set(node.capacityMeshNodeId, percentUsed)
        this.nodeOptimizationAttemptCountMap.set(node.capacityMeshNodeId, 0)
      }

      this.connectionsWithNodes = this.initialSolver.connectionsWithNodes

      this.stage = "section-optimization"
    }
  }

  _getNextNodeToOptimize(): CapacityMeshNodeId | null {
    // Get the node with the highest % capacity used with no attempts
    let highestNodePfDivAttempts = 0
    let highestNodePf = 0
    let nodeWithHighestPercentCapacityUsed: CapacityMeshNodeId | null = null
    for (const node of this.nodes) {
      if (node._containsTarget) continue
      const attemptCount = this.nodeOptimizationAttemptCountMap.get(
        node.capacityMeshNodeId,
      )!
      const totalCapacity = this.totalNodeCapacityMap.get(
        node.capacityMeshNodeId,
      )!
      const nodePf = calculateNodeProbabilityOfFailure(
        this.usedNodeCapacityMap.get(node.capacityMeshNodeId) ?? 0,
        totalCapacity,
        node.availableZ.length,
      )
      const nodePfDivAttempts = nodePf / (attemptCount + 1)
      if (
        attemptCount < this.MAX_ATTEMPTS_PER_NODE &&
        nodePfDivAttempts > highestNodePfDivAttempts &&
        nodePf > 0.2
      ) {
        highestNodePfDivAttempts = nodePfDivAttempts
        highestNodePf = nodePf
        nodeWithHighestPercentCapacityUsed = node.capacityMeshNodeId
      }
    }
    console.log(`Highest node Pf: ${highestNodePf}`)
    return nodeWithHighestPercentCapacityUsed
  }

  _stepSectionOptimization() {
    if (!this.sectionSolver) {
      const centerNodeId = this._getNextNodeToOptimize()
      if (!centerNodeId) {
        // No more nodes to optimize
        this.solved = true
        return
      }
      this.sectionSolver = new CapacityPathingSingleSectionSolver({
        centerNodeId,
        connectionsWithNodes: this.connectionsWithNodes,
        nodes: this.nodes,
        edges: this.edges,
        colorMap: this.colorMap,
        hyperParameters: {
          EXPANSION_DEGREES: 3,
          SHUFFLE_SEED: this.iterations,
        },
      })
      this.activeSubSolver = this.sectionSolver
      this.nodeOptimizationAttemptCountMap.set(
        centerNodeId,
        (this.nodeOptimizationAttemptCountMap.get(centerNodeId) ?? 0) + 1,
      )
    }

    this.sectionSolver!.step()

    if (this.sectionSolver!.failed) {
      // If the section solver fails, mark the node as attempted but don't update paths
      // TODO: Consider more sophisticated failure handling? Maybe increase expansionDegrees?
      console.warn(
        `Section solver failed for node ${this.sectionSolver.centerNodeId}. Error: ${this.sectionSolver.error}`,
      )
      this.sectionSolver = null
      this.activeSubSolver = null
      return // Try the next node in the next step
    }

    if (this.sectionSolver!.solved) {
      const solvedSectionSolver = this.sectionSolver
      const pathingSolver = solvedSectionSolver.activeSubSolver
      this.sectionSolver = null // Clear active solver regardless of merge outcome
      this.activeSubSolver = null
      if (!pathingSolver || !pathingSolver.solved) {
        console.warn(
          `Pathing sub-solver for section ${solvedSectionSolver.centerNodeId} did not complete successfully. Discarding results.`,
        )
        return // Skip scoring and merging
      }

      const sectionNodeIds = new Set(
        solvedSectionSolver.sectionNodes.map((n) => n.capacityMeshNodeId),
      )

      // --- Calculate Before Score ---
      const beforeScore = computeSectionScore({
        totalNodeCapacityMap: this.totalNodeCapacityMap,
        usedNodeCapacityMap: this.usedNodeCapacityMap,
        nodeMap: this.nodeMap,
        sectionNodeIds,
      })

      // --- Calculate After Score (Simulated) ---
      // 1. Create a temporary capacity map reflecting the state *after* applying new paths
      const afterUsedCapacityMap = new Map(this.usedNodeCapacityMap)
      const newSectionPaths = pathingSolver.sectionConnectionTerminals

      // 2. Decrement capacity for original paths within the section
      for (const terminal of newSectionPaths) {
        const originalConnection = this.connectionsWithNodes.find(
          (conn) => conn.connection.name === terminal.connectionName,
        )
        if (originalConnection?.path) {
          for (const node of originalConnection.path) {
            if (sectionNodeIds.has(node.capacityMeshNodeId)) {
              const currentUsage =
                afterUsedCapacityMap.get(node.capacityMeshNodeId) ?? 0
              // Ensure usage doesn't go below zero if maps were somehow inconsistent
              afterUsedCapacityMap.set(
                node.capacityMeshNodeId,
                Math.max(0, currentUsage - 1),
              )
            }
          }
        }
      }

      // 3. Increment capacity for new paths within the section
      for (const terminal of newSectionPaths) {
        if (terminal.path) {
          for (const node of terminal.path) {
            // Only consider nodes within the section for the temporary map
            if (sectionNodeIds.has(node.capacityMeshNodeId)) {
              afterUsedCapacityMap.set(
                node.capacityMeshNodeId,
                (afterUsedCapacityMap.get(node.capacityMeshNodeId) ?? 0) + 1,
              )
            }
          }
        }
      }

      // 4. Calculate the score with the simulated capacity map
      const afterScore = computeSectionScore({
        totalNodeCapacityMap: this.totalNodeCapacityMap,
        usedNodeCapacityMap: afterUsedCapacityMap,
        nodeMap: this.nodeMap,
        sectionNodeIds,
      })

      // --- Compare and Merge ---
      if (afterScore > beforeScore) {
        console.log(
          `Section ${
            solvedSectionSolver.centerNodeId
          } improved score (${beforeScore.toFixed(
            2,
          )} -> ${afterScore.toFixed(2)}). Merging results.`,
        )
        // Section solver succeeded AND improved score, merge the results
        this._mergeSolvedSectionPaths(solvedSectionSolver) // Pass the original section solver instance
        this._recalculateNodeCapacityUsage() // Recalculate global capacity after merging
      } else {
        // console.log(
        //   `Section ${
        //     solvedSectionSolver.centerNodeId
        //   } did not improve score (${beforeScore.toFixed(
        //     2,
        //   )} -> ${afterScore.toFixed(2)}). Discarding results.`,
        // )
        // Score did not improve, do not merge. Capacity remains unchanged.
      }
    }
  }

  /**
   * Merges the paths found by a successful section solver back into the main
   * connectionsWithNodes list.
   */
  private _mergeSolvedSectionPaths(
    solvedSectionSolver: CapacityPathingSingleSectionSolver,
  ) {
    // Ensure the pathing sub-solver actually ran and has results
    const pathingSolver = solvedSectionSolver.activeSubSolver
    if (!pathingSolver || !pathingSolver.solved) {
      console.warn(
        `Pathing sub-solver for section ${solvedSectionSolver.centerNodeId} did not complete successfully. Skipping merge.`,
      )
      return
    }

    const solvedTerminals = pathingSolver.sectionConnectionTerminals

    for (const solvedTerminal of solvedTerminals) {
      if (!solvedTerminal.path) {
        // Pathing might have failed for this specific connection within the section
        console.warn(
          `No path found for connection ${solvedTerminal.connectionName} in section ${solvedSectionSolver.centerNodeId}`,
        )
        continue
      }

      const originalConnection = this.connectionsWithNodes.find(
        (conn) => conn.connection.name === solvedTerminal.connectionName,
      )

      if (!originalConnection || !originalConnection.path) {
        console.warn(
          `Original connection or path not found for ${solvedTerminal.connectionName} while merging section ${solvedSectionSolver.centerNodeId}`,
        )
        continue
      }

      const originalPath = originalConnection.path
      const newSectionPath = solvedTerminal.path

      // Find the indices in the original path corresponding to the section terminals
      const startIndex = originalPath.findIndex(
        (node) => node.capacityMeshNodeId === solvedTerminal.startNodeId,
      )
      const endIndex = originalPath.findIndex(
        (node) => node.capacityMeshNodeId === solvedTerminal.endNodeId,
      )

      if (startIndex === -1 || endIndex === -1) {
        console.warn(
          `Could not find start/end nodes (${solvedTerminal.startNodeId}/${solvedTerminal.endNodeId}) in original path for ${solvedTerminal.connectionName}`,
        )
        continue
      }

      // Ensure start comes before end in the original path array
      // (Path direction might be reversed relative to section definition)
      const [actualStartIndex, actualEndIndex] =
        startIndex <= endIndex ? [startIndex, endIndex] : [endIndex, startIndex]

      // Construct the new path: part before section + new section path + part after section
      const pathBefore = originalPath.slice(0, actualStartIndex)
      const pathAfter = originalPath.slice(actualEndIndex + 1)

      // The newSectionPath might be reversed relative to the original path direction.
      // Check if the start of newSectionPath matches the node at actualStartIndex.
      // If not, reverse newSectionPath.
      let orientedNewSectionPath = newSectionPath
      if (
        newSectionPath.length > 0 &&
        originalPath[actualStartIndex] && // Check if node exists
        newSectionPath[0].capacityMeshNodeId !==
          originalPath[actualStartIndex].capacityMeshNodeId
      ) {
        // It's possible the section path connects directly to the node *after* the end index
        // or *before* the start index if the section boundary was tight.
        // A more robust check compares the connection points.
        // Let's assume for now the section solver respects the start/end node IDs provided.
        // If the first node of the new path doesn't match the node at the start index,
        // and the last node *does* match, then reverse.
        if (
          newSectionPath[newSectionPath.length - 1].capacityMeshNodeId ===
          originalPath[actualStartIndex].capacityMeshNodeId
        ) {
          orientedNewSectionPath = [...newSectionPath].reverse()
        } else {
          // This case is problematic - the new path doesn't seem to connect correctly.
          console.warn(
            `New section path for ${solvedTerminal.connectionName} doesn't align with original path boundaries. Skipping merge for this connection.`,
          )
          continue // Skip merging this specific path
        }
      }

      originalConnection.path = [
        ...pathBefore,
        ...orientedNewSectionPath,
        ...pathAfter,
      ]
    }
  }

  /**
   * Recalculates node capacity usage based on the current connectionsWithNodes
   * and updates the nodeCapacityPercentMap.
   */
  private _recalculateNodeCapacityUsage() {
    // Clear the existing map
    this.usedNodeCapacityMap.clear()

    // Sum capacity usage from all current paths into the class property
    for (const conn of this.connectionsWithNodes) {
      if (!conn.path) continue
      for (const node of conn.path) {
        this.usedNodeCapacityMap.set(
          node.capacityMeshNodeId,
          (this.usedNodeCapacityMap.get(node.capacityMeshNodeId) ?? 0) + 1,
        )
      }
    }

    // Update the percentage map using the updated class property and the total capacity map
    for (const node of this.nodes) {
      const totalCapacity =
        this.totalNodeCapacityMap.get(node.capacityMeshNodeId) ?? 0 // Use stored total capacity
      const usedCapacity =
        this.usedNodeCapacityMap.get(node.capacityMeshNodeId) ?? 0 // Use class property
      const percentUsed = totalCapacity > 0 ? usedCapacity / totalCapacity : 0 // Avoid division by zero

      this.nodeCapacityPercentMap.set(node.capacityMeshNodeId, percentUsed)
    }
  }

  getCapacityPaths(): CapacityPath[] {
    const capacityPaths: CapacityPath[] = []
    for (const connection of this.connectionsWithNodes) {
      const path = connection.path
      if (path) {
        capacityPaths.push({
          capacityPathId: connection.connection.name,
          connectionName: connection.connection.name,
          nodeIds: path.map((node) => node.capacityMeshNodeId),
        })
      }
    }
    return capacityPaths
  }

  _step() {
    if (this.iterations >= this.MAX_ITERATIONS - 1) {
      // We're just an optimizer so we can't fail
      this.solved = true
      return
    }
    if (this.stage === "initialization") {
      this._stepInitialization()
    } else if (this.stage === "section-optimization") {
      this._stepSectionOptimization()
    }
  }

  visualize() {
    // Prepare completed paths data for visualization
    const completedPathsForViz = this.connectionsWithNodes
      .filter((conn) => conn.path && conn.path.length > 0)
      .map((conn) => ({
        connectionName: conn.connection.name,
        path: conn.path!, // Assert path exists due to filter
      }))

    return visualizeSection({
      nodeMap: this.nodeMap,
      // Still show terminals for context, even if paths are drawn separately
      sectionConnectionTerminals: this.connectionsWithNodes.map((conn) => ({
        connectionName: conn.connection.name,
        startNodeId: conn.path?.[0]?.capacityMeshNodeId!,
        endNodeId: conn.path?.[conn.path.length - 1]?.capacityMeshNodeId!,
        // path: conn.path // Optionally pass the path here too if visualizeSection uses it for terminals
      })),
      completedPaths: completedPathsForViz, // Pass the final paths
      sectionNodes: this.nodes,
      sectionEdges: this.edges,
      colorMap: this.colorMap,
      totalCapacityMap: this.totalNodeCapacityMap,
      usedNodeCapacityMap: this.usedNodeCapacityMap,
      nodeOpacity: 0.05,
      title: "Capacity Pathing Multi-Section Solver (Solved)",
    })

    // // Visualization for intermediate steps remains the same
    // return (
    //   this.activeSubSolver?.activeSubSolver?.visualize() ??
    //   this.activeSubSolver?.visualize() ??
    //   this.initialSolver.visualize()
    // )
  }
}
