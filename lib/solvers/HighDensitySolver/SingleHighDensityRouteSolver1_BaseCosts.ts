import { distance } from "@tscircuit/math-utils"
import { SingleHighDensityRouteSolver } from "./SingleHighDensityRouteSolver"
import { Node } from "lib/data-structures/SingleRouteCandidatePriorityQueue"

export class SingleHighDensityRouteSolver1_BaseCosts extends SingleHighDensityRouteSolver {
  computeH(node: Node) {
    const goalDist = distance(node, this.B)
    const goalDistPercent = goalDist / this.straightLineDistance

    // Base cost from original function
    const baseCost =
      goalDist + Math.abs(node.z - this.B.z) * this.viaPenaltyDistance

    return baseCost
  }

  computeG(node: Node) {
    // Base cost from original function
    const baseCost =
      (node.parent?.g ?? 0) +
      (node.z === node.parent?.z ? 0 : this.viaPenaltyDistance) +
      distance(node, node.parent!)

    return baseCost
  }
}
