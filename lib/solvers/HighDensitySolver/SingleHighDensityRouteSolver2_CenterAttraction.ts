import { distance } from "@tscircuit/math-utils"
import { SingleHighDensityRouteSolver } from "./SingleHighDensityRouteSolver"
import { Node } from "lib/data-structures/SingleRouteCandidatePriorityQueue"

export class SingleHighDensityRouteSolver2_CenterAttraction extends SingleHighDensityRouteSolver {
  CENTER_PENALTY_SCALE_H = 0.4
  CENTER_PENALTY_SCALE_G = this.CENTER_PENALTY_SCALE_H

  computeH(node: Node) {
    const goalDist = distance(node, this.B)
    const goalDistPercent = goalDist / this.straightLineDistance

    // Base cost from original function
    const baseCost =
      goalDist + Math.abs(node.z - this.B.z) * this.viaPenaltyDistance

    // Add center distance penalty
    // Scale factor can be adjusted to make the penalty stronger/weaker
    const distanceFromCenter = distance(node, this.boundsCenter)
    const maxPossibleDistance = Math.sqrt(
      (this.boundsSize.width / 2) ** 2 + (this.boundsSize.height / 2) ** 2,
    )

    // Normalize the center distance penalty to be relative to the bounds size
    const centerPenalty =
      (distanceFromCenter / maxPossibleDistance) *
      this.CENTER_PENALTY_SCALE_H *
      this.straightLineDistance

    return baseCost + centerPenalty
  }

  computeG(node: Node) {
    // Base cost from original function
    const baseCost =
      (node.parent?.g ?? 0) +
      (node.z === node.parent?.z ? 0 : this.viaPenaltyDistance) +
      distance(node, node.parent!)

    // Add center distance penalty
    // Use a smaller scale for G to avoid over-penalizing
    const distanceFromCenter = distance(node, this.boundsCenter)
    const maxPossibleDistance = Math.sqrt(
      (this.boundsSize.width / 2) ** 2 + (this.boundsSize.height / 2) ** 2,
    )

    // Normalize the center distance penalty
    const centerPenalty =
      (distanceFromCenter / maxPossibleDistance) *
      this.CENTER_PENALTY_SCALE_G *
      this.straightLineDistance

    return baseCost + centerPenalty
  }
}
