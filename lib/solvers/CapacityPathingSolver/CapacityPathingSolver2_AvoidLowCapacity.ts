import type { CapacityMeshNode } from "lib/types"
import { CapacityPathingSolver, type Candidate } from "./CapacityPathingSolver"

export class CapacityPathingSolver2_AvoidLowCapacity extends CapacityPathingSolver {
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
      ) /
        this.getTotalCapacity(node)
    )
  }
}
