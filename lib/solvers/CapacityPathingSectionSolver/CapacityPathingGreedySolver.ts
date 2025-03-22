import { CapacityMeshNode } from "lib/types"
import { CapacityPathingSolver5 } from "../CapacityPathingSolver/CapacityPathingSolver5"

export class CapacityPathingGreedySolver extends CapacityPathingSolver5 {
  doesNodeHaveCapacityForTrace(
    node: CapacityMeshNode,
    prevNode: CapacityMeshNode,
  ): boolean {
    return true
  }
}
