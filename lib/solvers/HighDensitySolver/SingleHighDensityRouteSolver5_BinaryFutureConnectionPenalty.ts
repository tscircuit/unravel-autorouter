import { distance } from "@tscircuit/math-utils"
import { SingleHighDensityRouteSolver } from "./SingleHighDensityRouteSolver"
import { Node } from "lib/data-structures/SingleRouteCandidatePriorityQueue"

export class SingleHighDensityRouteSolver5_BinaryFutureConnectionPenalty extends SingleHighDensityRouteSolver {
  getClosestFutureConnectionPoint(node: Node) {
    let minDist = Infinity
    let closestPoint = null

    for (const futureConnection of this.futureConnections) {
      for (const point of futureConnection.points) {
        const dist = distance(node, point)
        if (dist < minDist) {
          minDist = dist
          closestPoint = point
        }
      }
    }

    return closestPoint
  }

  getFutureConnectionPenalty(node: Node, isVia: boolean) {
    let futureConnectionPenalty = 0
    const closestFuturePoint = this.getClosestFutureConnectionPoint(node)
    if (closestFuturePoint) {
      const distToFuturePoint = distance(node, closestFuturePoint)
      const maxDist = this.viaDiameter * 10
      const distRatio = distToFuturePoint / maxDist
      futureConnectionPenalty =
        (isVia ? this.straightLineDistance * 10 : this.straightLineDistance) *
        Math.exp(-5 * distRatio)
    }
    return futureConnectionPenalty
  }

  computeH(node: Node) {
    const goalDist = distance(node, this.B)

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

    return (
      baseCost +
      this.getFutureConnectionPenalty(node, node.z === node.parent?.z)
    )
  }
}
