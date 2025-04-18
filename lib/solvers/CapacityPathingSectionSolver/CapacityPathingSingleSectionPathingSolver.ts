import { GraphicsObject } from "graphics-debug"
import {
  CapacityMeshEdge,
  CapacityMeshNode,
  CapacityMeshNodeId,
} from "lib/types"
import { BaseSolver } from "../BaseSolver"
import { visualizeSection } from "./visualizeSection"
import { getNodeEdgeMap } from "../CapacityMeshSolver/getNodeEdgeMap" // Added import
import { getTunedTotalCapacity1 } from "lib/utils/getTunedTotalCapacity1" // Added import
import { distance } from "@tscircuit/math-utils" // Added import
import { safeTransparentize } from "../colors" // Added import
import { createRectFromCapacityNode } from "lib/utils/createRectFromCapacityNode" // Added import
import { cloneAndShuffleArray } from "lib/utils/cloneAndShuffleArray"

// Copied from CapacityPathingSolver
export type Candidate = {
  prevCandidate: Candidate | null
  node: CapacityMeshNode
  f: number
  g: number
  h: number
}

export interface CpssPathingSolverHyperParameters {
  SHUFFLE_SEED?: number
}

export interface CapacityPathingSingleSectionPathingSolverParams {
  sectionNodes: CapacityMeshNode[]
  sectionEdges: CapacityMeshEdge[]
  sectionConnectionTerminals: Array<{
    // Corrected this part
    connectionName: string
    startNodeId: CapacityMeshNodeId
    endNodeId: CapacityMeshNodeId
    // Store the original full path for context if needed later
    // originalPath?: CapacityMeshNode[];
  }>
  colorMap?: Record<string, string> // Make colorMap optional in params
  hyperParameters?: CpssPathingSolverHyperParameters
}

export class CapacityPathingSingleSectionPathingSolver extends BaseSolver {
  // --- Properties from CapacityPathingSolver & CapacityPathingSolver5 ---
  GREEDY_MULTIPLIER = 2.5 // From CapacityPathingSolver5 constructor override
  NEGATIVE_CAPACITY_PENALTY_FACTOR = 1 // From CapacityPathingSolver5
  REDUCED_CAPACITY_PENALTY_FACTOR = 1 // From CapacityPathingSolver5
  sectionNodes: CapacityMeshNode[]
  sectionEdges: CapacityMeshEdge[]
  sectionConnectionTerminals: Array<{
    connectionName: string
    startNodeId: CapacityMeshNodeId
    endNodeId: CapacityMeshNodeId
    path?: CapacityMeshNode[] // To store the result for this connection
  }>
  nodeMap: Map<CapacityMeshNodeId, CapacityMeshNode> // Map of nodes *within the section*
  nodeEdgeMap: Map<CapacityMeshNodeId, CapacityMeshEdge[]> // Edges *within the section*
  colorMap: Record<string, string>
  usedNodeCapacityMap: Map<CapacityMeshNodeId, number> // Tracks capacity usage *within this solver's run*

  // A* state
  currentConnectionIndex = 0
  candidates?: Array<Candidate> | null = null
  visitedNodes?: Set<CapacityMeshNodeId> | null = null
  queuedNodes?: Set<CapacityMeshNodeId> | null = null
  activeCandidateStraightLineDistance?: number
  debug_lastNodeCostMap: Map<
    CapacityMeshNodeId,
    {
      g: number
      h: number
      f: number
    }
  > = new Map()

  // TODO: Decide if maxCapacityFactor needs to be configurable via hyperParameters
  maxCapacityFactor = 1 // Default, similar to CapacityPathingSolver5

  constructor(params: CapacityPathingSingleSectionPathingSolverParams) {
    super()

    this.sectionNodes = params.sectionNodes
    this.sectionEdges = params.sectionEdges
    // Initialize path property for each terminal
    this.sectionConnectionTerminals = params.sectionConnectionTerminals.map(
      (t) => ({ ...t, path: undefined }),
    )
    this.nodeMap = new Map(
      this.sectionNodes.map((n) => [n.capacityMeshNodeId, n]),
    )
    this.nodeEdgeMap = getNodeEdgeMap(this.sectionEdges) // Use only section edges
    this.colorMap = params.colorMap ?? {}

    // Initialize capacity map, potentially with starting values
    this.usedNodeCapacityMap = new Map(
      this.sectionNodes.map((node) => [node.capacityMeshNodeId, 0]),
    )

    if (params.hyperParameters?.SHUFFLE_SEED) {
      this.sectionConnectionTerminals = cloneAndShuffleArray(
        this.sectionConnectionTerminals,
        params.hyperParameters?.SHUFFLE_SEED,
      )
    }
    // Sort connections? (Maybe not necessary if order is determined by caller)
    // this.sectionConnectionTerminals.sort((a, b) => ...);
  }

  // --- Methods adapted from CapacityPathingSolver & CapacityPathingSolver5 ---

  // Adapted from CapacityPathingSolver5
  getTotalCapacity(node: CapacityMeshNode): number {
    return getTunedTotalCapacity1(node, this.maxCapacityFactor)
  }

  // Adapted from CapacityPathingSolver5
  getNodeCapacityPenalty(node: CapacityMeshNode): number {
    if (!this.nodeMap.has(node.capacityMeshNodeId)) return Infinity // Penalize leaving section heavily

    const MAX_PENALTY = node.width + node.height
    const MIN_PENALTY = 0.05
    const START_PENALIZING_CAPACITY_WHEN_IT_DROPS_BELOW = 2

    const totalCapacity = this.getTotalCapacity(node)
    const usedCapacity =
      this.usedNodeCapacityMap.get(node.capacityMeshNodeId) ?? 0
    const remainingCapacity = totalCapacity - usedCapacity

    if (remainingCapacity > START_PENALIZING_CAPACITY_WHEN_IT_DROPS_BELOW) {
      return MIN_PENALTY
    }

    // Simplified penalty calculation from Solver5
    const penalty =
      (MAX_PENALTY - MIN_PENALTY) *
        Math.max(
          0, // Ensure penalty doesn't go below MIN_PENALTY due to calculation
          (START_PENALIZING_CAPACITY_WHEN_IT_DROPS_BELOW - remainingCapacity) /
            START_PENALIZING_CAPACITY_WHEN_IT_DROPS_BELOW, // Normalize based on threshold
        ) +
      MIN_PENALTY

    // Clamp penalty to MAX_PENALTY
    return Math.min(penalty, MAX_PENALTY)
  }

  // Adapted from CapacityPathingSolver5 (using simple distance)
  getDistanceBetweenNodes(A: CapacityMeshNode, B: CapacityMeshNode): number {
    const dx = A.center.x - B.center.x
    const dy = A.center.y - B.center.y
    return Math.sqrt(dx ** 2 + dy ** 2)
  }

  // Adapted from CapacityPathingSolver5
  computeG(
    prevCandidate: Candidate,
    node: CapacityMeshNode,
    endGoal: CapacityMeshNode, // endGoal is not strictly needed here but kept for signature consistency
  ): number {
    return (
      prevCandidate.g +
      this.getDistanceBetweenNodes(prevCandidate.node, node) +
      this.getNodeCapacityPenalty(node) // Apply penalty on arrival at the node
    )
  }

  // Adapted from CapacityPathingSolver5
  computeH(
    prevCandidate: Candidate, // prevCandidate not strictly needed here
    node: CapacityMeshNode,
    endGoal: CapacityMeshNode,
  ): number {
    // Heuristic is distance to goal + estimated penalty at the current node
    return (
      this.getDistanceBetweenNodes(node, endGoal) +
      this.getNodeCapacityPenalty(node) // Consider penalty of the current node for heuristic
    )
  }

  // Adapted from CapacityPathingSolver
  getBacktrackedPath(candidate: Candidate): CapacityMeshNode[] {
    const path: CapacityMeshNode[] = []
    let currentCandidate: Candidate | null = candidate
    while (currentCandidate) {
      path.push(currentCandidate.node)
      // Ensure the node exists in our section map before adding
      if (this.nodeMap.has(currentCandidate.node.capacityMeshNodeId)) {
        currentCandidate = currentCandidate.prevCandidate
      } else {
        // Should not happen if search stays within bounds, but safety break
        console.warn("Backtracked path went outside section bounds")
        break
      }
    }
    return path.reverse() // Path is built end-to-start, reverse it
  }

  // Adapted from CapacityPathingSolver - uses section's nodeEdgeMap
  getNeighboringNodes(node: CapacityMeshNode): CapacityMeshNode[] {
    if (!this.nodeMap.has(node.capacityMeshNodeId)) return [] // Node not in section

    return (
      this.nodeEdgeMap
        .get(node.capacityMeshNodeId)
        ?.flatMap((edge): CapacityMeshNodeId[] =>
          edge.nodeIds.filter((n) => n !== node.capacityMeshNodeId),
        )
        .map((nId) => this.nodeMap.get(nId)!)
        .filter(Boolean) ?? [] // Ensure nodes exist in the section map and filter out undefined
    )
  }

  // Adapted from CapacityPathingSolver - uses section's nodeEdgeMap
  isConnectedToEndGoal(
    node: CapacityMeshNode,
    endGoal: CapacityMeshNode,
  ): boolean {
    if (
      !this.nodeMap.has(node.capacityMeshNodeId) ||
      !this.nodeMap.has(endGoal.capacityMeshNodeId)
    )
      return false

    return (this.nodeEdgeMap.get(node.capacityMeshNodeId) ?? []).some((edge) =>
      edge.nodeIds.includes(endGoal.capacityMeshNodeId),
    )
  }

  // Adapted from CapacityPathingSolver - uses section's capacity map and total capacity calculation
  doesNodeHaveCapacityForTrace(
    node: CapacityMeshNode,
    prevNode: CapacityMeshNode | null, // Can be null for the start node
  ): boolean {
    return true
  }

  // Adapted from CapacityPathingSolver - uses section's capacity map
  reduceCapacityAlongPath(path: CapacityMeshNode[]) {
    for (const node of path) {
      // Only reduce capacity for nodes within our section
      if (this.usedNodeCapacityMap.has(node.capacityMeshNodeId)) {
        this.usedNodeCapacityMap.set(
          node.capacityMeshNodeId,
          (this.usedNodeCapacityMap.get(node.capacityMeshNodeId) ?? 0) + 1,
        )
      }
    }
  }

  _step() {
    const currentTerminal =
      this.sectionConnectionTerminals[this.currentConnectionIndex]
    if (!currentTerminal) {
      this.solved = true // All connections processed
      return
    }

    const startNode = this.nodeMap.get(currentTerminal.startNodeId)
    const endNode = this.nodeMap.get(currentTerminal.endNodeId)

    if (!startNode || !endNode) {
      console.error(
        `Start or end node not found in section for connection ${currentTerminal.connectionName}`,
      )
      // Mark this connection as failed? Or skip?
      this.currentConnectionIndex++
      this.candidates = null
      this.visitedNodes = null
      // Consider setting this.failed = true if any connection fails critically
      return
    }

    // Initialize A* for the current connection if not already started
    if (!this.candidates) {
      this._setupAStar(startNode, endNode)
    }

    const candidates = this.candidates!

    if (candidates.length === 0) {
      this._handleCandidatesExhausted(currentTerminal)
      return
    }

    candidates.sort((a, b) => a.f - b.f)
    const currentCandidate = candidates.shift()! // Not null due to check above
    // Add the node selected for expansion to the visited/closed set
    this.visitedNodes!.add(currentCandidate.node.capacityMeshNodeId)

    // Check if goal reached
    // Use direct ID check first, then isConnectedToEndGoal if needed (e.g., for adjacent nodes)
    if (
      currentCandidate.node.capacityMeshNodeId === endNode.capacityMeshNodeId
    ) {
      this._handleGoalReached(currentCandidate, currentTerminal, endNode)
      return
    }

    // Explore neighbors
    const neighborNodes = this.getNeighboringNodes(currentCandidate.node)
    for (const neighborNode of neighborNodes) {
      // Skip if already visited
      if (this.queuedNodes?.has(neighborNode.capacityMeshNodeId)) {
        continue
      }

      // Skip if node lacks capacity (using the adapted check)
      if (
        !this.doesNodeHaveCapacityForTrace(neighborNode, currentCandidate.node)
      ) {
        continue
      }

      // Skip if it's an obstacle node and not a designated terminal for *this* connection
      // (Obstacle logic might need refinement based on how obstacles are represented in sections)
      // if (neighborNode._containsObstacle && !(neighborNode.capacityMeshNodeId === startNode.capacityMeshNodeId || neighborNode.capacityMeshNodeId === endNode.capacityMeshNodeId)) {
      //    continue;
      // }

      // Calculate costs
      const g = this.computeG(currentCandidate, neighborNode, endNode)
      const h = this.computeH(currentCandidate, neighborNode, endNode)
      const f = g + h * this.GREEDY_MULTIPLIER

      this.debug_lastNodeCostMap.set(neighborNode.capacityMeshNodeId, {
        f,
        g,
        h,
      })

      // Create and add the new candidate
      const newCandidate: Candidate = {
        prevCandidate: currentCandidate,
        node: neighborNode,
        f,
        g,
        h,
      }
      this.queuedNodes?.add(neighborNode.capacityMeshNodeId)
      candidates!.push(newCandidate)
      // Do NOT add to visitedNodes here. Add only when a node is popped from candidates.
    }

    // Mark current node as fully processed (closed list) - This happens when the node is popped from candidates and added to visitedNodes.
    // No, visitedNodes is the open list + closed list. Let's stick to adding when pushing to candidates.
    // this.visitedNodes!.add(currentCandidate.node.capacityMeshNodeId); // This seems redundant if added above
  }

  private _setupAStar(startNode: CapacityMeshNode, endNode: CapacityMeshNode) {
    this.candidates = [
      { prevCandidate: null, node: startNode, f: 0, g: 0, h: 0 },
    ]
    this.visitedNodes = new Set([startNode.capacityMeshNodeId])
    this.debug_lastNodeCostMap = new Map() // Reset costs for the new connection
    this.activeCandidateStraightLineDistance = distance(
      startNode.center,
      endNode.center,
    )

    // Initial cost calculation for start node
    const initialH = this.computeH(null!, startNode, endNode)
    this.candidates[0].h = initialH
    this.candidates[0].f = initialH * this.GREEDY_MULTIPLIER // g is 0
    this.debug_lastNodeCostMap.set(startNode.capacityMeshNodeId, {
      f: this.candidates[0].f,
      g: 0,
      h: initialH,
    })
    this.queuedNodes = new Set([startNode.capacityMeshNodeId])
  }

  private _handleCandidatesExhausted(currentTerminal: {
    connectionName: string
  }) {
    console.error(
      `Ran out of candidates for section connection ${currentTerminal.connectionName}`,
    )
    // Failed to find path for this connection
    this.currentConnectionIndex++
    this.candidates = null
    this.visitedNodes = null
    this.queuedNodes = null
    // Optionally mark the solver as failed if any path fails
    // this.failed = true;
  }

  private _handleGoalReached(
    currentCandidate: Candidate,
    currentTerminal: {
      connectionName: string
      startNodeId: CapacityMeshNodeId
      endNodeId: CapacityMeshNodeId
      path?: CapacityMeshNode[]
    },
    endNode: CapacityMeshNode, // Pass endNode if needed for checks like isConnectedToEndGoal
  ) {
    // Found the path for the current connection
    const path = this.getBacktrackedPath(currentCandidate)
    // If using isConnectedToEndGoal, might need to add endNode explicitly if not the current node
    // if (path[path.length - 1]?.capacityMeshNodeId !== endNode.capacityMeshNodeId) {
    //    path.push(endNode);
    // }

    currentTerminal.path = path // Store the found path
    this.reduceCapacityAlongPath(path) // Update capacity usage

    // Move to the next connection
    this.currentConnectionIndex++
    this.candidates = null
    this.visitedNodes = null
    this.queuedNodes = null
  }

  visualize(): GraphicsObject {
    // Prepare data for completed paths visualization
    const completedPathsForViz = this.sectionConnectionTerminals
      .filter((t) => t.path && t.path.length > 0) // Only include terminals with a solved path
      .map((t) => ({
        connectionName: t.connectionName,
        path: t.path!, // Assert path is defined due to filter
      }))

    // Base visualization from visualizeSection
    const baseGraphics = visualizeSection({
      sectionNodes: this.sectionNodes,
      sectionEdges: this.sectionEdges,
      sectionConnectionTerminals: this.sectionConnectionTerminals, // Still pass terminals for start/end points
      completedPaths: completedPathsForViz, // Pass the solved paths
      nodeMap: this.nodeMap, // Pass the section's node map
      colorMap: this.colorMap,
      centerNodeId: null, // No single center node for pathing visualization
      title: `Section Pathing: Conn ${this.currentConnectionIndex + 1}/${
        this.sectionConnectionTerminals.length
      } (${this.sectionNodes.length} nodes)`,
      nodeOpacity: 0.1,
    })

    // Enhance with A* specific visualization (Keep this part)

    // 1. Highlight node costs (f, g, h) and capacity usage
    for (const node of this.sectionNodes) {
      const rectIndex = baseGraphics.rects!.findIndex((r) =>
        r.label?.includes(node.capacityMeshNodeId),
      )
      if (rectIndex !== -1) {
        const costs = this.debug_lastNodeCostMap.get(node.capacityMeshNodeId)
        const usedCapacity =
          this.usedNodeCapacityMap.get(node.capacityMeshNodeId) ?? 0
        const totalCapacity = this.getTotalCapacity(node)
        const capacityLabel = `${usedCapacity.toFixed(1)}/${totalCapacity.toFixed(
          1,
        )}`
        const costLabel = costs
          ? `f:${costs.f.toFixed(1)} g:${costs.g.toFixed(
              1,
            )} h:${costs.h.toFixed(1)}`
          : "cost:?"

        baseGraphics.rects![rectIndex].label = [
          node.capacityMeshNodeId,
          `Cap: ${capacityLabel}`,
          costLabel,
          `Z: ${node.availableZ.join(",")}`,
        ].join("\n")

        // Add stroke if over capacity
        if (usedCapacity > totalCapacity) {
          baseGraphics.rects![rectIndex].stroke = safeTransparentize("red", 0.7)
        }
      }
    }

    // 2. Visualize candidate paths (top few)
    if (this.candidates && this.candidates.length > 0) {
      const topCandidates = this.candidates
        .slice() // Create a copy
        .sort((a, b) => a.f - b.f) // Ensure sorted by f-cost
        .slice(0, 5) // Take top 5

      const currentTerminal =
        this.sectionConnectionTerminals[this.currentConnectionIndex]
      const connectionName = currentTerminal?.connectionName ?? "unknown"
      const connectionColor = this.colorMap[connectionName] ?? "purple" // Default color

      topCandidates.forEach((candidate, index) => {
        const opacity = 0.8 * (1 - index / 5) // Decreasing opacity
        const path = this.getBacktrackedPath(candidate)
        if (path.length > 0) {
          baseGraphics.lines!.push({
            points: path.map(({ center: { x, y } }) => ({ x, y })),
            strokeColor: safeTransparentize(connectionColor, 1 - opacity),
            strokeWidth: 0.05,
          })
        }
      })
    }

    return baseGraphics
  }
}
