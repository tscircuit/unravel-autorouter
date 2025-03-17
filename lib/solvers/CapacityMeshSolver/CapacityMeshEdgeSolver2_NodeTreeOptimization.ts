import type { GraphicsObject } from "graphics-debug"
import type {
  CapacityMeshEdge,
  CapacityMeshNode,
} from "../../types/capacity-mesh-types"
import { BaseSolver } from "../BaseSolver"
import { distance } from "@tscircuit/math-utils"
import { areNodesBordering } from "lib/utils/areNodesBordering"
import { CapacityMeshEdgeSolver } from "./CapacityMeshEdgeSolver"
import { CapacityNodeTree } from "lib/data-structures/CapacityNodeTree"

export class CapacityMeshEdgeSolver2_NodeTreeOptimization extends CapacityMeshEdgeSolver {
  step() {
    this.edges = []
    const edgeSet = new Set<string>()

    const nodeTree = new CapacityNodeTree(this.nodes)

    for (let i = 0; i < this.nodes.length; i++) {
      const A = this.nodes[i]
      const maybeAdjNodes = nodeTree.getNodesInArea(
        A.center.x,
        A.center.y,
        A.width * 2,
        A.height * 2,
      )

      for (const B of maybeAdjNodes) {
        const areBordering = areNodesBordering(A, B)
        if (!areBordering) continue
        const strawNodesWithSameParent =
          A._strawNode &&
          B._strawNode &&
          A._strawParentCapacityMeshNodeId === B._strawParentCapacityMeshNodeId
        if (
          !strawNodesWithSameParent &&
          this.doNodesHaveSharedLayer(A, B) &&
          !edgeSet.has(`${A.capacityMeshNodeId}-${B.capacityMeshNodeId}`)
        ) {
          edgeSet.add(`${A.capacityMeshNodeId}-${B.capacityMeshNodeId}`)
          edgeSet.add(`${B.capacityMeshNodeId}-${A.capacityMeshNodeId}`)
          this.edges.push({
            capacityMeshEdgeId: this.getNextCapacityMeshEdgeId(),
            nodeIds: [A.capacityMeshNodeId, B.capacityMeshNodeId],
          })
        }
      }
    }

    this.handleTargetNodes()

    this.solved = true
  }
}
