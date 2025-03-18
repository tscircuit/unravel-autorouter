import { distance } from "@tscircuit/math-utils"
import { SingleHighDensityRouteSolver } from "./SingleHighDensityRouteSolver"
import { Node } from "lib/data-structures/SingleRouteCandidatePriorityQueue"

export class SingleHighDensityRouteSolver7_CostPoint extends SingleHighDensityRouteSolver {
  FUTURE_CONNECTION_PROX_TRACE_PENALTY_FACTOR = 2
  FUTURE_CONNECTION_PROX_VIA_PENALTY_FACTOR = 1
  FUTURE_CONNECTION_PROXIMITY_VD = 10
  MISALIGNED_DIST_PENALTY_FACTOR = 5
  VIA_PENALTY_FACTOR_2 = 1

  COST_POINT_STRENGTH = 10000
  COST_POINT_PX = 0
  COST_POINT_PY = 1
  COST_POINT_PRADIUS = 0.5

  FLIP_TRACE_ALIGNMENT_DIRECTION = false

  constructor(
    opts: ConstructorParameters<typeof SingleHighDensityRouteSolver>[0],
  ) {
    super(opts)
    for (const key in opts.hyperParameters) {
      // @ts-ignore
      this[key] = opts.hyperParameters[key]
    }

    // Ratio of available space determines via penalty
    const viasThatCanFitHorz = this.boundsSize.width / this.viaDiameter
    this.VIA_PENALTY_FACTOR =
      0.3 * (viasThatCanFitHorz / this.numRoutes) * this.VIA_PENALTY_FACTOR_2
  }

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

  /**
   * Rapidly approaches 0 as the goal distance approaches 0
   */
  diminishCloseToGoal(node: Node) {
    const goalDist = distance(node, this.B)
    return 1 - Math.exp((-goalDist / this.straightLineDistance) * 5)
  }

  getFutureConnectionPenalty(node: Node, isVia: boolean) {
    let futureConnectionPenalty = 0
    const closestFuturePoint = this.getClosestFutureConnectionPoint(node)
    const goalDist = distance(node, this.B)
    if (closestFuturePoint) {
      const distToFuturePoint = distance(node, closestFuturePoint)
      if (goalDist <= distToFuturePoint) return 0
      const maxDist = this.viaDiameter * this.FUTURE_CONNECTION_PROXIMITY_VD
      const distRatio = distToFuturePoint / maxDist
      futureConnectionPenalty =
        (isVia
          ? this.straightLineDistance *
            this.FUTURE_CONNECTION_PROX_VIA_PENALTY_FACTOR
          : this.straightLineDistance *
            this.FUTURE_CONNECTION_PROX_TRACE_PENALTY_FACTOR) *
        Math.exp(-distRatio * 5)
    }
    return futureConnectionPenalty
  }

  get costPoint() {
    return {
      x: this.COST_POINT_PX * this.boundsSize.width + this.bounds.minX,
      y: this.COST_POINT_PY * this.boundsSize.height + this.bounds.minY,
    }
  }

  getCostPointPenalty(node: Node) {
    const costPointDist = distance(node, this.costPoint)
    const costPointPercent =
      costPointDist / (this.COST_POINT_PRADIUS * this.boundsSize.width)
    return (
      this.COST_POINT_STRENGTH * (1 / costPointPercent) * this.boundsSize.width
    )
  }

  computeH(node: Node) {
    const goalDist = distance(node, this.B) ** 1.6
    const goalDistRatio = goalDist / this.straightLineDistance

    // Base cost from original function
    const baseCost =
      goalDist + (node.z !== this.B.z ? this.viaPenaltyDistance : 0)

    return (
      baseCost +
      this.getFutureConnectionPenalty(node, node.z !== node.parent?.z) +
      this.getCostPointPenalty(node)
    )
  }

  computeG(node: Node) {
    const dx = Math.abs(node.x - node.parent!.x)
    const dy = Math.abs(node.y - node.parent!.y)
    const dist = Math.sqrt(dx ** 2 + dy ** 2)

    const misalignedDist = !this.FLIP_TRACE_ALIGNMENT_DIRECTION
      ? node.z === 0
        ? dy
        : dx
      : node.z === 0
        ? dx
        : dy

    // Base cost from original function
    const baseCost =
      (node.parent?.g ?? 0) +
      (node.z === node.parent?.z ? 0 : this.viaPenaltyDistance) +
      dist +
      misalignedDist * this.MISALIGNED_DIST_PENALTY_FACTOR

    return (
      baseCost +
      this.getFutureConnectionPenalty(node, node.z !== node.parent?.z) +
      this.getCostPointPenalty(node)
    )
  }

  visualize() {
    const go = super.visualize()

    go.circles?.push({
      center: this.costPoint,
      radius: this.COST_POINT_PRADIUS * this.boundsSize.width,
      fill: "rgba(255,0,0,0.25)",
    })

    return go
  }
}
