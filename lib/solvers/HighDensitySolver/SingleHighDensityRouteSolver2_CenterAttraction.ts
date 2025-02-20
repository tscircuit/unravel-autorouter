import { distance } from "@tscircuit/math-utils"
import {
  SingleHighDensityRouteSolver,
  type Node,
} from "./SingleHighDensityRouteSolver"

export class SingleHighDensityRouteSolver2_CenterAttraction extends SingleHighDensityRouteSolver {
  CENTER_PENALTY_SCALE_H = 0.1
  CENTER_PENALTY_SCALE_G = 0.05

  computeH(node: Node) {
    // Base cost from original function
    const baseCost =
      distance(node, this.B) +
      Math.abs(node.z - this.B.z) * this.viaPenaltyDistance

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
      (node.z === 0 ? 0 : this.viaPenaltyDistance) +
      distance(node, node.parent!)

    // Add center distance penalty
    // Use a smaller scale for G to avoid over-penalizing
    const CENTER_PENALTY_SCALE = 0.1
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
