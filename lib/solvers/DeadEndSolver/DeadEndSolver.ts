import { CapacityMeshEdge, CapacityMeshNode } from "lib/types"
import { BaseSolver } from "../BaseSolver"

export class DeadEndSolver extends BaseSolver {
  public removedNodeIds: Set<string>

  private targetNodeIds: Set<string>
  private leaves: string[]
  private leavesIndex: number
  private adjacencyList: Map<string, Set<string>>

  constructor({
    nodes,
    edges,
  }: {
    nodes: CapacityMeshNode[]
    edges: CapacityMeshEdge[]
  }) {
    super()

    this.MAX_ITERATIONS = nodes.length

    this.removedNodeIds = new Set()

    this.targetNodeIds = new Set(
      nodes.filter((n) => n._containsTarget).map((n) => n.capacityMeshNodeId),
    )

    this.adjacencyList = new Map(
      nodes.map(({ capacityMeshNodeId }) => [capacityMeshNodeId, new Set()]),
    )

    // Build an adjacency list based on the edges
    for (const {
      nodeIds: [u, v],
    } of edges) {
      this.adjacencyList.get(u)!.add(v)
      this.adjacencyList.get(v)!.add(u)
    }

    // Determine all nodes that have only a single link (leaves of a tree) and
    //  are not a target.
    this.leavesIndex = 0
    this.leaves = [...this.adjacencyList.entries()]
      .filter(([_, neighbours]) => neighbours.size === 1)
      .filter(([nodeId, _]) => !this.targetNodeIds.has(nodeId))
      .map(([nodeId, _]) => nodeId)
  }

  _step() {
    if (this.leavesIndex === this.leaves.length) {
      this.solved = true
      return
    }

    const leaf = this.leaves[this.leavesIndex]

    // Get the single neighbor of the leaf node
    const [neighbor] = this.adjacencyList.get(leaf)!

    const neighborsOfLeafNeighbor = this.adjacencyList.get(neighbor)!

    // Remove the leaf from the adjacency list of the neighbor of the leaf.
    // This is, by definition, the only entry in the adjacency map that links
    // to the leaf. Hence, there is no other reference to the leaf and it will
    // never be visited again.
    neighborsOfLeafNeighbor.delete(leaf)

    // Add the leaf to the list of removed ids
    this.removedNodeIds.add(neighbor)

    // Check if the neighbour of the leaf has now become a leaf such that it can
    // be removed in a future iteration.
    if (
      neighborsOfLeafNeighbor.size === 1 &&
      !this.targetNodeIds.has(neighbor)
    ) {
      this.leaves.push(neighbor)
    }

    this.leavesIndex += 1
  }
}
