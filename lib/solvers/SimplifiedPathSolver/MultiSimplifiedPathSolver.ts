import { HighDensityIntraNodeRoute } from "lib/types/high-density-types"
import { BaseSolver } from "../BaseSolver"
import { Obstacle } from "lib/types"
import { SingleSimplifiedPathSolver2 } from "./SingleSimplifiedPathSolver2"

export class MultiSimplifiedPathSolver extends BaseSolver {
  simplifiedHdRoutes: HighDensityIntraNodeRoute[]

  currentUnsimplifiedHdRouteIndex = 0

  constructor(
    public unsimplifiedHdRoutes: HighDensityIntraNodeRoute[],
    public obstacles: Obstacle[],
  ) {
    super()
    this.simplifiedHdRoutes = []
  }

  _step() {
    const hdRoute =
      this.unsimplifiedHdRoutes[this.currentUnsimplifiedHdRouteIndex]
    if (!hdRoute) {
      this.solved = true
      return
    }

    const solver = new SingleSimplifiedPathSolver2(
      hdRoute,
      this.unsimplifiedHdRoutes
        .slice(this.currentUnsimplifiedHdRouteIndex + 1)
        .concat(this.simplifiedHdRoutes),
      this.obstacles,
    )

    this.simplifiedHdRoutes.push(solver.simplifiedRoute)
    this.currentUnsimplifiedHdRouteIndex++
  }
}
