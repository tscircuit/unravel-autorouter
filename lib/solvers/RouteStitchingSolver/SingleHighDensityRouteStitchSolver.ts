import { HighDensityIntraNodeRoute } from "lib/types/high-density-types"
import { BaseSolver } from "../BaseSolver"

export class SingleHighDensityRouteSticherSolver extends BaseSolver {
  remainingHdRoutes: HighDensityIntraNodeRoute[]
  start: { x: number; y: number; z: number }
  end: { x: number; y: number; z: number }

  constructor(opts: {
    hdRoutes: HighDensityIntraNodeRoute[]
    start: { x: number; y: number; z: number }
    end: { x: number; y: number; z: number }
  }) {
    super()
    this.remainingHdRoutes = [...opts.hdRoutes]
    this.start = opts.start
    this.end = opts.end
  }

  _step() {}
}
