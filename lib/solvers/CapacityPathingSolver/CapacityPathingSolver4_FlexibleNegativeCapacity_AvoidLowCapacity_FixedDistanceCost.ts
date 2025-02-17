import type { CapacityMeshNode } from "lib/types"
import { CapacityPathingSolver, type Candidate } from "./CapacityPathingSolver"

export class CapacityPathingSolver4_FlexibleNegativeCapacity_AvoidLowCapacity_FixedDistanceCost extends CapacityPathingSolver {
  /**
   * In the FlexibleNegativeCapacity mode, we allow negative capacity
   */
  doesNodeHaveCapacityForTrace(node: CapacityMeshNode): boolean {
    return true
  }

  computeG(
    prevCandidate: Candidate,
    node: CapacityMeshNode,
    endGoal: CapacityMeshNode,
  ) {
    const nodeCapacity = this.getCapacity(node)

    const distMultiplier = 1 / 2 ** nodeCapacity

    return prevCandidate.g + prevCandidate.h * distMultiplier
  }
}
