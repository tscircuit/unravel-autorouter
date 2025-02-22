import type { CapacityMeshNode } from "lib/types"
import { CapacityPathingSolver, type Candidate } from "./CapacityPathingSolver"

export class CapacityPathingSolver4_FlexibleNegativeCapacity_AvoidLowCapacity_FixedDistanceCost extends CapacityPathingSolver {
  /**
   * In the FlexibleNegativeCapacity mode, we allow negative capacity
   */
  doesNodeHaveCapacityForTrace(node: CapacityMeshNode): boolean {
    return true
  }

  getTotalCapacity(node: CapacityMeshNode): number {
    const VIA_DIAMETER = 0.6
    const TRACE_WIDTH = 0.15

    const viaLengthAcross = Math.floor(node.width / VIA_DIAMETER / 2)

    console.log(node)

    return viaLengthAcross
  }

  // computeG(
  //   prevCandidate: Candidate,
  //   node: CapacityMeshNode,
  //   endGoal: CapacityMeshNode,
  // ) {
  //   const nodeCapacity = this.getCapacity(node)

  //   const distMultiplier = 1 / 2 ** nodeCapacity

  //   return prevCandidate.g + prevCandidate.h * distMultiplier
  // }

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
      )
    )
  }

  computeH(
    prevCandidate: Candidate,
    node: CapacityMeshNode,
    endGoal: CapacityMeshNode,
  ) {
    return Math.sqrt(
      (node.center.x - endGoal.center.x) ** 2 +
        (node.center.y - endGoal.center.y) ** 2,
    )
  }
}
