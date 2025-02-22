import type { CapacityMeshNode } from "lib/types"
import { CapacityPathingSolver, type Candidate } from "./CapacityPathingSolver"

export class CapacityPathingSolver4_FlexibleNegativeCapacity extends CapacityPathingSolver {
  NEGATIVE_CAPACITY_PENALTY_FACTOR = 1

  get maxCapacityFactor() {
    return this.hyperParameters.MAX_CAPACITY_FACTOR ?? 1
  }

  /**
   * In the FlexibleNegativeCapacity mode, we allow negative capacity
   */
  doesNodeHaveCapacityForTrace(node: CapacityMeshNode): boolean {
    return true
  }

  getTotalCapacity(node: CapacityMeshNode): number {
    const VIA_DIAMETER = 0.6
    const TRACE_WIDTH = 0.15

    const viaLengthAcross = Math.round(node.width / VIA_DIAMETER / 2)

    return viaLengthAcross * this.maxCapacityFactor
  }

  /**
   * Penalty you pay for using this node
   */
  getNodeCapacityPenalty(node: CapacityMeshNode): number {
    const nodeCapacity =
      this.getTotalCapacity(node) -
      this.usedNodeCapacityMap.get(node.capacityMeshNodeId)!

    const dist =
      this.activeCandidateStraightLineDistance! *
      (this.NEGATIVE_CAPACITY_PENALTY_FACTOR / 4)

    if (nodeCapacity <= 0) {
      const penalty = 2 ** -nodeCapacity * dist
      return penalty
    }

    // Penalize for using nodes with low capacity by 25% of the straight line
    // distance
    return (1 / nodeCapacity) * dist * 0.5
  }

  computeG(
    prevCandidate: Candidate,
    node: CapacityMeshNode,
    endGoal: CapacityMeshNode,
  ) {
    return (
      prevCandidate.g +
      Math.sqrt(
        (node.center.x - prevCandidate.node.center.x) ** 2 +
          (node.center.y - prevCandidate.node.center.y) ** 2,
      ) +
      this.getNodeCapacityPenalty(node)
    )
  }

  computeH(
    prevCandidate: Candidate,
    node: CapacityMeshNode,
    endGoal: CapacityMeshNode,
  ) {
    return (
      Math.sqrt(
        (node.center.x - endGoal.center.x) ** 2 +
          (node.center.y - endGoal.center.y) ** 2,
      ) + this.getNodeCapacityPenalty(node)
    )
  }
}
