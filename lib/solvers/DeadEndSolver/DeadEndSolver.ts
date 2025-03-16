import { CapacityMeshEdge, CapacityMeshNode } from "lib/types";
import { BaseSolver } from "../BaseSolver";

export class DeadEndSolver extends BaseSolver {
    public removedNodeIds: Set<string>

    private targetNodeIds: Set<string>
    private leaves: Set<string>
    private adjacency: Map<string, Set<string>>

    constructor({nodes, edges}: {
        nodes: CapacityMeshNode[],
        edges: CapacityMeshEdge[]
    }) {
        super()

        this.removedNodeIds = new Set();

        this.targetNodeIds = new Set(
            nodes
                .filter((n) => n._containsTarget)
                .map((n) => n.capacityMeshNodeId)
        );

        this.adjacency = new Map(
            nodes.map(({ capacityMeshNodeId }) => [capacityMeshNodeId, new Set()])
        );

        // Build an adjacency list based on the edges
        for (const { nodeIds: [u, v] } of edges) {
            this.adjacency.get(u)!.add(v);
            this.adjacency.get(v)!.add(u);
        }

        // Determine all nodes that have only a single link (leaves of a tree) and
        //  are not a target.
        this.leaves = new Set(
            this.adjacency.entries()
                .filter(([_, neighbours]) => neighbours.size === 1)
                .filter(([nodeId, _]) => !this.targetNodeIds.has(nodeId))
                .map(([nodeId, _]) => nodeId)
        );

    }

    _step() {
        if (this.leaves.size === 0) {
            this.solved = true;
            return;
        }

        const newLeaves = new Set<string>();

        for (const leaf of this.leaves) {
            // Get the single neighbor of the leaf node
            const [neighbor] = this.adjacency.get(leaf)!;

            const neighborsOfLeafNeighbor = this.adjacency.get(neighbor)!;

            // Remove the leaf from the adjacency list of the neighbor of the leaf.
            // Note that it is not required to remove the leaf from the adjacency map 
            neighborsOfLeafNeighbor.delete(leaf); 

            // Add the leaf to the list of removed ids
            this.removedNodeIds.add(neighbor);

            // If neighbor becomes a leaf and is not a target, add it to the new leaves
            if (neighborsOfLeafNeighbor.size === 1 && !this.targetNodeIds.has(neighbor)) {
                newLeaves.add(neighbor);
            }
        }

        this.leaves = newLeaves;
    }
}