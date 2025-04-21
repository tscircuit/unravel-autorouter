import { CapacityMeshNode } from "lib/types"
import { CapacityPathingSolver5 } from "../CapacityPathingSolver/CapacityPathingSolver5"

export class CapacityPathingGreedySolver extends CapacityPathingSolver5 {
  doesNodeHaveCapacityForTrace(
    node: CapacityMeshNode,
    prevNode: CapacityMeshNode,
  ): boolean {
    return true
  }

  getNodeCapacityPenalty(node: CapacityMeshNode): number {
    if (!this.nodeMap.has(node.capacityMeshNodeId)) return Infinity // Penalize leaving section heavily
    /**
     * Roughly, -1 remaining capacity is penalized to this much distance
     */
    const mmPenaltyFactor = 4
    const MIN_PENALTY = 0.05
    const totalCapacity = this.getTotalCapacity(node)
    const usedCapacity =
      this.usedNodeCapacityMap.get(node.capacityMeshNodeId) ?? 0
    const remainingCapacity = totalCapacity - usedCapacity - 1
    if (remainingCapacity > 0) {
      return 0
    }
    // const probabilityOfFailure = calculateNodeProbabilityOfFailure(
    //   usedCapacity,
    //   totalCapacity,
    //   node.availableZ.length,
    // )
    let singleLayerUsagePenaltyFactor = 1
    if (node.availableZ.length === 1) {
      singleLayerUsagePenaltyFactor = 10
    }
    return (
      (MIN_PENALTY + Math.abs(remainingCapacity) * mmPenaltyFactor) *
      singleLayerUsagePenaltyFactor
    )
  }
}
