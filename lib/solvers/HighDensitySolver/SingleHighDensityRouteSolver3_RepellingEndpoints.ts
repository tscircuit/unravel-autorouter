import { distance } from "@tscircuit/math-utils"
import {
  SingleHighDensityRouteSolver,
  type Node,
} from "./SingleHighDensityRouteSolver"

export class SingleHighDensityRouteSolver3_RepelEndpoints extends SingleHighDensityRouteSolver {
  ENDPOINT_REPULSION_SCALE_H = 0.4
  ENDPOINT_REPULSION_SCALE_G = this.ENDPOINT_REPULSION_SCALE_H

  /**
   * Calculate repulsion cost from future connection endpoints
   */
  calculateEndpointRepulsionCost(node: Node) {
    if (!this.futureConnections.length) return 0

    let totalRepulsionCost = 0
    let minDistance = Infinity

    // For each future connection, calculate repulsion from both endpoints
    for (const connection of this.futureConnections) {
      if (connection.points.length < 2) continue

      // Get start and end points
      const startPoint = connection.points[0]
      const endPoint = connection.points[connection.points.length - 1]

      // Calculate distances to both endpoints
      const distToStart = distance(node, startPoint)
      const distToEnd = distance(node, endPoint)

      // Track minimum distance to any endpoint
      minDistance = Math.min(minDistance, distToStart, distToEnd)

      // Repulsion force increases as we get closer to endpoints
      const repulsionStart = this.straightLineDistance / (distToStart + 0.1)
      const repulsionEnd = this.straightLineDistance / (distToEnd + 0.1)

      totalRepulsionCost += repulsionStart + repulsionEnd
    }

    // Normalize repulsion cost relative to straight line distance
    const normalizedCost =
      totalRepulsionCost /
      this.futureConnections.length /
      (this.straightLineDistance * 2)

    return normalizedCost
  }

  computeH(node: Node) {
    // Base cost from original function
    const baseCost =
      distance(node, this.B) +
      Math.abs(node.z - this.B.z) * this.viaPenaltyDistance

    // Add endpoint repulsion penalty
    const repulsionCost =
      this.calculateEndpointRepulsionCost(node) *
      this.ENDPOINT_REPULSION_SCALE_H *
      this.straightLineDistance

    return baseCost + repulsionCost
  }

  computeG(node: Node) {
    // Base cost from original function
    const baseCost =
      (node.parent?.g ?? 0) +
      (node.z === node.parent?.z ? 0 : this.viaPenaltyDistance) +
      distance(node, node.parent!)

    // Add endpoint repulsion penalty
    const repulsionCost =
      this.calculateEndpointRepulsionCost(node) *
      this.ENDPOINT_REPULSION_SCALE_G *
      this.straightLineDistance

    return baseCost + repulsionCost
  }
}
