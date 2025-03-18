import { distance } from "@tscircuit/math-utils"
import { SingleHighDensityRouteSolver } from "./SingleHighDensityRouteSolver"
import { Node } from "lib/data-structures/SingleRouteCandidatePriorityQueue"

export class SingleHighDensityRouteSolver4_RepelEdgeViaFuture extends SingleHighDensityRouteSolver {
  ENDPOINT_REPULSION_SCALE_H = 0.05
  ENDPOINT_REPULSION_SCALE_G = this.ENDPOINT_REPULSION_SCALE_H

  // New factors for edge repulsion
  EDGE_REPULSION_SCALE = 0.1
  EDGE_VIA_PENALTY_SCALE = 2.0

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

  /**
   * Calculate repulsion cost from board edges
   */
  calculateEdgeRepulsionCost(node: Node) {
    // Calculate distances to each edge
    const distToLeft = node.x - this.bounds.minX
    const distToRight = this.bounds.maxX - node.x
    const distToTop = node.y - this.bounds.minY
    const distToBottom = this.bounds.maxY - node.y

    // Find minimum distance to any edge
    const minEdgeDist = Math.min(
      distToLeft,
      distToRight,
      distToTop,
      distToBottom,
    )

    // Calculate normalized distance (0 at edge, 1 at center)
    const normalizedDist =
      minEdgeDist /
      Math.min(this.boundsSize.width / 2, this.boundsSize.height / 2)

    // Inverse distance for repulsion (stronger near edges)
    return 1 - normalizedDist
  }

  /**
   * Calculate additional via penalty when near edges
   */
  calculateEdgeViaPenalty(node: Node, isViaTransition: boolean) {
    if (!isViaTransition) return 0

    const edgeRepulsion = this.calculateEdgeRepulsionCost(node)
    const edgeRepulsionSq = edgeRepulsion ** 2

    // Scale via penalty based on proximity to edge
    return (
      this.viaPenaltyDistance * this.EDGE_VIA_PENALTY_SCALE * edgeRepulsionSq
    )
  }

  computeH(node: Node) {
    // Base cost from original function
    const baseCost =
      distance(node, this.B) +
      Math.abs(node.z - this.B.z) * this.viaPenaltyDistance

    // Add endpoint repulsion penalty
    const endpointRepulsionCost =
      this.calculateEndpointRepulsionCost(node) *
      this.ENDPOINT_REPULSION_SCALE_H *
      this.straightLineDistance

    // Add edge repulsion penalty
    const edgeRepulsionCost =
      this.calculateEdgeRepulsionCost(node) *
      this.EDGE_REPULSION_SCALE *
      this.straightLineDistance

    // Add edge-sensitive via penalty
    const edgeViaPenalty = this.calculateEdgeViaPenalty(
      node,
      node.z !== this.B.z,
    )

    return baseCost + endpointRepulsionCost + edgeRepulsionCost + edgeViaPenalty
  }

  computeG(node: Node) {
    // Base cost from original function
    const baseCost =
      (node.parent?.g ?? 0) +
      (node.z === node.parent?.z ? 0 : this.viaPenaltyDistance) +
      distance(node, node.parent!)

    // Add endpoint repulsion penalty
    const endpointRepulsionCost =
      this.calculateEndpointRepulsionCost(node) *
      this.ENDPOINT_REPULSION_SCALE_G *
      this.straightLineDistance

    // Add edge repulsion penalty
    const edgeRepulsionCost =
      this.calculateEdgeRepulsionCost(node) *
      this.EDGE_REPULSION_SCALE *
      this.straightLineDistance

    // Add edge-sensitive via penalty
    const edgeViaPenalty = this.calculateEdgeViaPenalty(
      node,
      node.z !== node.parent?.z,
    )

    return baseCost + endpointRepulsionCost + edgeRepulsionCost + edgeViaPenalty
  }
}
